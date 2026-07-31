# Sales Invoice Eligibility

Canonical trigger: issue/post (non-Draft, non-Proforma) on create or Draft→issued update. Credit invoice fiscalized once; later payments excluded.

---
*Phase 11 implementation. Local sales eligibility + bridge only. No MRA Sale submission, fiscal number, QR, or “MRA validated” receipt. Bridge creates no Journal/Stock Movement. Customer payments are not Sales. Draft/Quote/Proforma excluded.*
