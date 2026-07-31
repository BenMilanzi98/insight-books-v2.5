# PHASE 14 DEPLOYMENT PLAN

Migrate Phase 14 tables; install qrcode/jsqr/pngjs; keep MRA_EIS_USE_MOCK=1; do not enable production receipt contracts.

---
*Phase 14 implementation. Fiscal receipts and validation QR codes are created only from conclusively accepted MRA response evidence + immutable fiscal snapshots. HTTP 200 alone is not acceptance. No synthetic production QR. Validation URLs are allowlisted. Original artifacts are immutable. Reprints preserve fiscal number/MRA txn/QR source. No Journal/Stock Movement. No MRA Sales resubmit. Production/live-sandbox receipt generation BLOCKED until QR/receipt contracts are verified.*
