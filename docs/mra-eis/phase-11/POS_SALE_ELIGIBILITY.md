# POS Sale Eligibility

Canonical trigger: completed sale via `POST /api/sales` (not receipt print). Preflight before TX; bridge after accounting commit.

---
*Phase 11 implementation. Local sales eligibility + bridge only. No MRA Sale submission, fiscal number, QR, or “MRA validated” receipt. Bridge creates no Journal/Stock Movement. Customer payments are not Sales. Draft/Quote/Proforma excluded.*
