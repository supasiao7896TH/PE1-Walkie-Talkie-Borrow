# Project Context — PE1 Walkie Talkie Borrow

## เกี่ยวกับโปรเจกต์

**PE1 Walkie Talkie Borrow** คือระบบยืม-คืนวิทยุสื่อสาร (walkie-talkie) สำหรับพนักงานแผนกผลิต 1
ใช้งานผ่านเว็บแบบ PWA (Progressive Web App) เปิดผ่านมือถือ/แท็บเล็ตได้ทันทีโดยไม่ต้องติดตั้งแอปจาก store

**URL ใช้งานจริง:** https://supasiao7896th.github.io/PE1-Walkie-Talkie-Borrow/

## ปัญหาที่แก้

ก่อนมีระบบนี้ การยืม-คืนวิทยุสื่อสารในแผนกผลิตติดตามด้วยกระดาษ/ปากเปล่า ทำให้ตรวจสอบว่าใครถือเครื่องไหนอยู่ยาก
เครื่องหาย หรือเกินกำหนดคืนไม่มีใครรู้ ระบบนี้บันทึกทุกการยืม-คืนแบบเรียลไทม์ ให้ทั้งพนักงานและแอดมิน (หัวหน้างาน)
เห็นสถานะตรงกันตลอดเวลา

## ผู้ใช้งาน

- **พนักงานทั่วไป** — กรอกรหัสพนักงาน + ชื่อ เพื่อยืม/คืนวิทยุด้วยตัวเอง ไม่ต้อง login
- **แอดมิน (หัวหน้างาน)** — ยืนยันตัวตนด้วย PIN 4 หลัก (ตรวจสอบฝั่ง server) เพื่อเข้าถึงแผงควบคุม —
  อนุมัติรับคืน, เรียกคืนฉุกเฉิน (force recall), โอนเครื่อง (reassign), จัดการคลังอุปกรณ์, ดูประวัติ/export CSV

## เทคโนโลยีโดยสรุป

แอปทั้งหมดอยู่ใน `index.html` ไฟล์เดียว (ไม่มี build step สำหรับ JS) ใช้ Tailwind CSS ที่ compile ไว้ล่วงหน้า,
Firebase (Firestore + Anonymous Auth + Cloud Functions + Cloud Messaging) เป็น backend, deploy ผ่าน GitHub
Pages + GitHub Actions

รายละเอียดเชิงลึก/กฎการทำงานที่ต้องรู้ก่อนแก้โค้ด ดูที่ [`AGENTS.md`](./AGENTS.md) (สำหรับ AI coding agent ทุกตัว)
หรือ [`CLAUDE.md`](./CLAUDE.md) (สำหรับ Claude Code โดยเฉพาะ — เนื้อหาเดียวกัน)

## สถานะปัจจุบัน

ฟีเจอร์หลักใช้งานได้ครบแล้ว: ยืม-คืนอุปกรณ์, force recall, reassign, overdue tracking, in-app history + export
CSV, push notification, admin PIN แบบยืนยันฝั่ง server (Cloud Function + Firebase custom claim)

**ฟีเจอร์ที่ยังไม่ทำ:** สถานะซ่อม/ชำรุด (maintenance) ของอุปกรณ์ — ดูรายละเอียดใน `AGENTS.md` หัวข้อ
"ฟีเจอร์ที่เลื่อนไว้"
