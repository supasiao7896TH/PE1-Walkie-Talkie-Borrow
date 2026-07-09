# CLAUDE.md — PE1 Walkie Talkie Borrow Project Guide

คู่มือนี้ให้ Claude อ่านก่อนเริ่มงานทุกครั้ง เพื่อให้เข้าใจโครงสร้างและขั้นตอนที่ถูกต้องโดยไม่ต้องอธิบายซ้ำ

---

## ภาพรวมโปรเจกต์

**PE1 Walkie Talkie Borrow** คือระบบยืม-คืนวิทยุสื่อสารสำหรับแผนกผลิต 1 ทำงานเป็น PWA (Progressive Web App)
- URL: `https://supasiao7896th.github.io/PE1-Walkie-Talkie-Borrow/`
- ภาษาของ UI: **ภาษาไทย**
- รูปแบบ: Single-page app — โค้ดทั้งหมดอยู่ใน `index.html` ไฟล์เดียว

---

## Tech Stack

| ส่วน | เทคโนโลยี |
|------|-----------|
| Frontend | HTML + Tailwind CSS (precompiled, ไม่ใช้ CDN) + Vanilla JavaScript |
| Font | Sarabun (Thai), Fraunces (display) — Google Fonts |
| Database | Firebase Firestore (real-time) |
| Auth | Firebase Anonymous Auth + `inMemoryPersistence` |
| Push Notification | Firebase Cloud Messaging (FCM) |
| Background Logic | Firebase Cloud Functions v2 (Node 20) |
| Hosting | GitHub Pages (static files) |
| CI/CD | GitHub Actions |
| PWA Cache | Service Worker (`sw.js`) |

---

## โครงสร้างไฟล์

```
PE1-Walkie-Talkie-Borrow/
├── index.html          ← แอปทั้งหมด (UI + logic รวมกัน)
├── sw.js               ← Service Worker: cache + FCM background handler
├── manifest.json       ← PWA metadata
├── icon-192.png        ← App icon
├── icon-512.png        ← App icon
├── tailwind.config.js  ← Tailwind build config (content/theme) — ใช้ตอน build เท่านั้น
├── input.css           ← Tailwind source (@tailwind base/components/utilities)
├── tailwind.css         ← Tailwind output ที่ compile แล้ว — index.html <link> ไปที่ไฟล์นี้
├── firestore.rules     ← Firestore security rules (deploy แยก — ดูหัวข้อด้านล่าง)
├── firebase.json       ← Firebase project config
├── .firebaserc         ← Firebase project alias
├── .github/
│   └── workflows/
│       └── deploy.yml  ← CI/CD: deploy Pages + Cloud Functions
└── functions/
    ├── index.js        ← Cloud Functions: push notification + verifyAdminPin/changeAdminPin (admin auth)
    └── package.json    ← dependencies: firebase-admin, firebase-functions
```

---

## Firestore Database Schema

```
artifacts/{appId}/public/data/
├── equipment/{docId}
│   ├── id, name, serial, status
│   ├── currentBorrower: { empId, empName }
│   ├── borrowedAt (timestamp ms)
│   └── updatedAt
├── logs/{docId}          ← create-only, ห้ามแก้/ลบ (audit trail)
│   ├── id, equipId, equipName
│   ├── empId, empName
│   ├── action ('borrow'|'return'|'approve'|'force_recall'|'reassign')
│   ├── timestamp (ms)
│   └── comment (optional)
└── adminTokens/{docId}   ← FCM tokens ของ admin
    ├── token (string)
    └── createdAt (ms)

adminSecrets/{docId}       ← top-level collection (ไม่อยู่ใต้ artifacts/...) เก็บ PIN hash + lockout
├── config → { pinHash, updatedAt }
└── lockout → { attempts, lockedUntil }
```

**⚠️ `adminSecrets` เข้าถึงได้เฉพาะ Cloud Functions (Admin SDK bypass rules) เท่านั้น — firestore.rules บล็อก client ทุกทาง (`allow read, write: if false`) ห้ามให้ client อ่าน/เขียนตรงเด็ดขาด**

**สถานะอุปกรณ์ที่ถูกต้อง:** `'available' | 'borrowed' | 'pending_return'`

---

## กฎสำคัญที่ต้องจำ

### 1. Service Worker Cache — ต้อง bump version ทุกครั้งที่แก้ `index.html` หรือ `sw.js`

ไฟล์: `sw.js` บรรทัด `const CACHE_NAME = 'pe1wt-vX'`

- เปลี่ยน `vX` → `v(X+1)` ทุกครั้งที่มี PR ใหม่
- ถ้าไม่ bump → มือถือที่ cache ไว้จะยังเห็นเวอร์ชันเก่า

**version ปัจจุบัน:** ตรวจสอบจาก `sw.js` ก่อนทุกครั้ง

### 2. Firestore Rules — **deploy แยก ไม่ผ่าน CI**

`deploy.yml` deploy เฉพาะ:
- GitHub Pages (job: `deploy-pages`) ✅
- Cloud Functions (job: `deploy-functions`) ✅

`firestore.rules` **ไม่ได้ deploy อัตโนมัติ** — ถ้าแก้ rules ต้อง deploy manual ผ่าน Firebase Console หรือ CLI:
```bash
npx firebase-tools deploy --only firestore:rules
```

### 3. Firebase Auth — ใช้ `inMemoryPersistence` เสมอ

เหตุผล: LINE / Facebook / Instagram WebView บน iOS และ Android บล็อก IndexedDB
ถ้าเปลี่ยนกลับเป็น default persistence → auth จะพังใน in-app browser

ตำแหน่งในโค้ด: ฟังก์ชัน `_initFirebase()` ใน `index.html`

### 4. Cloud Functions Token — `deploy-functions` อาจ fail

`FIREBASE_TOKEN` secret ใน GitHub อาจหมดอายุ → job `deploy-functions` จะ fail แต่ **ไม่กระทบ `deploy-pages`** ทั้งสอง job รันแยกกัน แก้โดย regenerate token แล้วอัพเดต GitHub Secret

### 5. Tailwind CSS — precompiled, ต้อง rebuild ทุกครั้งที่แก้/เพิ่ม class ใน `index.html`

ไม่ใช้ Tailwind Play CDN แล้ว (`cdn.tailwindcss.com` ใช้ได้แค่ dev/preview ไม่เหมาะกับ production) —
`index.html` ใช้ `<link rel="stylesheet" href="./tailwind.css" />` ที่ compile ไว้ล่วงหน้า

ทุกครั้งที่เพิ่ม/แก้ Tailwind class ใหม่ใน `index.html` **ต้อง rebuild ก่อน commit**:
```bash
npx --yes tailwindcss@3 -i ./input.css -o ./tailwind.css --minify --config ./tailwind.config.js
```
ถ้าลืม rebuild → class ใหม่จะไม่มี CSS rule คู่กัน (UI เพี้ยน แต่ไม่ error ให้เห็น)

ถ้าแก้ theme (สี, font) ให้แก้ `tailwind.config.js` ก่อน แล้วค่อย rebuild

### 6. Admin PIN — ยืนยันผ่าน Cloud Function ฝั่ง server แล้ว (ไม่ใช่แค่ client-side gate)

`verifyAdminPin`/`changeAdminPin` ใน `functions/index.js` ตรวจ PIN + ล็อกเอาต์ฝั่ง server และตั้ง
Firebase custom claim `admin: true` ให้ user เมื่อ PIN ถูกต้อง — `firestore.rules` บังคับ claim นี้กับ
equipment write ที่เป็น admin-only (approve return, force recall, reassign, edit, delete, add equipment)

**ผลที่ตามมา:**
- Admin ต้อง**ออนไลน์**เท่านั้นถึงจะ login/เปลี่ยน PIN ได้ (เดิม PIN check ทำงาน offline ได้ ตอนนี้ไม่ได้แล้ว)
- **ลำดับ deploy สำคัญมาก**: ต้อง deploy Cloud Functions (มี `verifyAdminPin`/`changeAdminPin` ใหม่)
  ให้สำเร็จก่อน แล้วค่อย deploy `firestore.rules` ด้วยมือ — ถ้า deploy rules ก่อน Cloud Function
  พร้อม จะไม่มีทางขอ claim ได้เลย แอดมินจะเข้าระบบไม่ได้ทั้งหมด
- PIN ที่เคยเปลี่ยนไว้ (เก็บใน localStorage เดิม) **ไม่ migrate มาอัตโนมัติ** — reset กลับเป็น default
  `1234` หลัง deploy รอบแรก ต้องรีบเข้าไปเปลี่ยน PIN ใหม่ทันทีผ่านหน้าแอดมิน

---

## ขั้นตอน Deploy ที่ถูกต้อง

```
1. แก้โค้ดใน index.html และ/หรือ sw.js
2. ถ้าแก้/เพิ่ม Tailwind class → rebuild tailwind.css ก่อน (ดูกฎข้อ 5)
3. bump CACHE_NAME ใน sw.js (vX → v(X+1)) ← อย่าลืม!
4. git add, git commit, git push → branch: claude/... หรือ feature branch
5. เปิด PR → merge to main
6. GitHub Actions รันอัตโนมัติ → deploy Pages + Functions
7. ตรวจสอบ Actions tab ว่า deploy-pages ✅ และ deploy-functions ✅
8. ถ้าแก้ functions/index.js ที่เกี่ยวกับ admin claim หรือแก้ firestore.rules
   ให้ทำตามลำดับในกฎข้อ 6 (Cloud Functions ก่อน แล้วค่อย deploy rules ด้วยมือ)
```

---

## ฟีเจอร์หลักของแอป

| ฟีเจอร์ | รายละเอียด |
|---------|-----------|
| ยืม-คืนอุปกรณ์ | พนักงานกรอก empId + กดยืม → admin อนุมัติ |
| Force Recall | admin บังคับคืนพร้อมบันทึกเหตุผล |
| Reassign | admin โอนอุปกรณ์จากคนหนึ่งไปอีกคน |
| Overdue Tracking | badge แสดงระยะเวลายืม + แจ้งเตือนเกินกำหนด (default 3 วัน) |
| In-app History | drawer แสดง log ทั้งหมด + ค้นหา + กรองประเภท |
| Push Notification | admin รับ notification เมื่ออุปกรณ์เปลี่ยนสถานะ |
| Export CSV | export log ทั้งหมดเป็น CSV |
| Admin PIN | ยืนยันฝั่ง server ผ่าน Cloud Function (SHA-256 hash + lockout 5 ครั้ง/5 นาที) + ตั้ง custom claim `admin: true` |
| LINE Banner | แจ้งเตือน iOS ให้เปิดใน Safari, Android ให้เปิดใน Chrome |

---

## LINE / WebView Handling

Banner HTML: `#line-banner` ใน `index.html` (~บรรทัด 99-145)
- ตรวจ UA ว่าอยู่ใน LINE / FB / IG browser
- iOS: แสดงวิธีเปิดใน Safari + ปุ่มคัดลอกลิงก์
- Android: แสดงวิธีเปิดใน Chrome + ปุ่มคัดลอกลิงก์
- ซ่อน banner อัตโนมัติเมื่อ sync status เป็น `'online'`

---

## Firebase Project Config

```
Project ID:    radiosync-6662c
App ID:        1:605359206228:web:bfbc3514675887d666e2c1
Sender ID:     605359206228
Auth Domain:   radiosync-6662c.firebaseapp.com
Storage:       radiosync-6662c.firebasestorage.app
```

---

## ฟีเจอร์ที่เลื่อนไว้ (Deferred)

- **สถานะซ่อม/ชำรุด (maintenance)** — ต้องเพิ่ม `'maintenance'` ใน `firestore.rules` status enum (ดู `request.resource.data.status in [...]` ในกฎ `update` equipment) แล้ว deploy rules manual ก่อน จึงค่อยเพิ่ม UI

---

## คำแนะนำสำหรับ Claude

- อธิบายเป็น**ภาษาไทย** เสมอ
- ก่อนแก้ไขโค้ดใดๆ ให้ **Read ไฟล์จริงก่อน** อย่า assume จาก context
- ทุกครั้งที่แก้ `index.html` → ให้ bump `CACHE_NAME` ใน `sw.js` ด้วยเสมอ
- ทุกครั้งที่แก้/เพิ่ม Tailwind class ใน `index.html` → ต้อง rebuild `tailwind.css` ก่อน commit (กฎข้อ 5)
- อย่า deploy `firestore.rules` ผ่าน CI (workflow ไม่รองรับ)
- ถ้าแก้ระบบ admin auth (`verifyAdminPin`/`changeAdminPin`/`firestore.rules`) ให้เตือนผู้ใช้เรื่องลำดับ deploy เสมอ (กฎข้อ 6)
- branch สำหรับ development: `claude/...` ตาม convention ที่กำหนดใน session
