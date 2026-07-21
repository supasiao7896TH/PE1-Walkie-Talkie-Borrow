'use strict';

const crypto                = require('crypto');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp }     = require('firebase-admin/app');
const { getMessaging }      = require('firebase-admin/messaging');
const { getFirestore }      = require('firebase-admin/firestore');
const { getAuth }           = require('firebase-admin/auth');

initializeApp();

// ─── Admin PIN verification (server-side; Firestore rules require the
// 'admin' custom claim minted here for any admin-only equipment write) ──────

const PIN_SALT      = 'radiosync-server-pin-salt-v2'; // server-only, never shipped to the client
const DEFAULT_PIN   = '1234';
const MAX_ATTEMPTS   = 5;
const LOCKOUT_MS     = 5 * 60 * 1000;
const APP_ID         = 'a-class-radiosync'; // matches client's default _appId (index.html) — __app_id is never injected in this static deployment

function hashPin(pin) {
  return crypto.createHash('sha256').update(pin + PIN_SALT).digest('hex');
}

exports.verifyAdminPin = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'ต้องเข้าสู่ระบบก่อน');
  const pin = String(request.data?.pin || '');

  const db       = getFirestore();
  const configRef = db.doc('adminSecrets/config');
  const lockRef    = db.doc('adminSecrets/lockout');

  return db.runTransaction(async (tx) => {
    const [lockSnap, configSnap] = await Promise.all([tx.get(lockRef), tx.get(configRef)]);
    const lockData = lockSnap.exists ? lockSnap.data() : {};
    const now = Date.now();

    if (lockData.lockedUntil && now < lockData.lockedUntil) {
      return { success: false, locked: true, remainingMs: lockData.lockedUntil - now };
    }

    const storedHash = configSnap.exists ? configSnap.data().pinHash : null;
    if (!configSnap.exists) {
      tx.set(configRef, { pinHash: hashPin(DEFAULT_PIN), updatedAt: now });
    }

    const inputHash = hashPin(pin);
    const effectiveHash = storedHash || hashPin(DEFAULT_PIN);

    if (inputHash === effectiveHash) {
      tx.set(lockRef, { attempts: 0, lockedUntil: 0 });
      await getAuth().setCustomUserClaims(request.auth.uid, { admin: true });
      return { success: true };
    }

    const attempts = (lockData.attempts || 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      tx.set(lockRef, { attempts: 0, lockedUntil: now + LOCKOUT_MS });
      return { success: false, locked: true, remainingMs: LOCKOUT_MS };
    }
    tx.set(lockRef, { attempts, lockedUntil: 0 });
    return { success: false, locked: false, remainingAttempts: MAX_ATTEMPTS - attempts };
  });
});

exports.changeAdminPin = onCall(async (request) => {
  if (!request.auth || request.auth.token.admin !== true) {
    throw new HttpsError('permission-denied', 'ต้องเป็นแอดมินก่อน');
  }
  const currentPin = String(request.data?.currentPin || '');
  const newPin     = String(request.data?.newPin || '');
  if (!/^\d{4}$/.test(newPin)) {
    return { success: false, error: 'invalid-format' };
  }

  const db        = getFirestore();
  const configRef = db.doc('adminSecrets/config');
  const snap      = await configRef.get();
  const storedHash = snap.exists ? snap.data().pinHash : hashPin(DEFAULT_PIN);

  if (hashPin(currentPin) !== storedHash) {
    return { success: false, error: 'wrong-current-pin' };
  }

  await configRef.set({ pinHash: hashPin(newPin), updatedAt: Date.now() });
  return { success: true };
});

// Permanently deletes all history logs. Admin-only; Firestore rules block
// client-side delete on 'logs' entirely (create-only audit trail) — this
// bypasses that via the Admin SDK, same mechanism as changeAdminPin above.
exports.clearAllHistory = onCall(async (request) => {
  if (!request.auth || request.auth.token.admin !== true) {
    throw new HttpsError('permission-denied', 'ต้องเป็นแอดมินก่อน');
  }

  const db      = getFirestore();
  const logsRef = db.collection(`artifacts/${APP_ID}/public/data/logs`);
  const snap    = await logsRef.get();
  const docs    = snap.docs;

  const CHUNK_SIZE = 450; // stay under Firestore's 500-writes-per-batch limit
  for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
    const batch = db.batch();
    docs.slice(i, i + CHUNK_SIZE).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  console.log(`clearAllHistory: admin ${request.auth.uid} deleted ${docs.length} log(s)`);
  return { success: true, deleted: docs.length };
});

exports.notifyAdminOnEquipmentChange = onDocumentUpdated(
  'artifacts/{appId}/public/data/equipment/{docId}',
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();

    if (!before || !after || before.status === after.status) return;

    let title, body;
    if (after.status === 'borrowed') {
      title = `📻 ${after.name} ถูกยืม`;
      body  = `รหัสพนักงาน: ${after.currentBorrower?.empId || '-'}`;
    } else if (after.status === 'pending_return') {
      title = `🔄 ${after.name} ส่งคืนรอตรวจ`;
      body  = `จาก: ${after.currentBorrower?.empId || '-'}`;
    } else {
      return;
    }

    const db     = getFirestore();
    const appId  = event.params.appId;

    const tokensSnap = await db
      .collection(`artifacts/${appId}/public/data/adminTokens`)
      .get();

    if (tokensSnap.empty) return;

    const tokens = tokensSnap.docs
      .map(d => d.data().token)
      .filter(t => typeof t === 'string' && t.length > 20);

    if (!tokens.length) return;

    const response = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      webpush: {
        notification: {
          icon:  'https://supasiao7896th.github.io/PE1-Walkie-Talkie-Borrow/icon-192.png',
          badge: 'https://supasiao7896th.github.io/PE1-Walkie-Talkie-Borrow/icon-192.png',
          requireInteraction: false,
        },
        fcmOptions: {
          link: 'https://supasiao7896th.github.io/PE1-Walkie-Talkie-Borrow/',
        },
      },
    });

    // Remove expired / invalid tokens automatically
    const staleIds = [];
    response.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code || '';
        if (code.includes('invalid-registration-token') ||
            code.includes('registration-token-not-registered')) {
          staleIds.push(tokensSnap.docs[i].id);
        }
      }
    });

    if (staleIds.length) {
      await Promise.all(
        staleIds.map(id =>
          db.doc(`artifacts/${appId}/public/data/adminTokens/${id}`).delete()
        )
      );
    }
  }
);
