# Outbox Atomicity

Bridge+outbox in same DB ops after eligibility; rolled-back sale cannot have outbox; duplicate keys idempotent.

---
*Phase 11 implementation. Local sales eligibility + bridge only. No MRA Sale submission, fiscal number, QR, or “MRA validated” receipt. Bridge creates no Journal/Stock Movement. Customer payments are not Sales. Draft/Quote/Proforma excluded.*
