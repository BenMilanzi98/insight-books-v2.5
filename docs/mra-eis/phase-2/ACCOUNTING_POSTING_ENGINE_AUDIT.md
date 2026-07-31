# Accounting Posting Engine Audit

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

`lib/accountingV2/engine/postingEngine.js`: registry claim → journal → outbox enqueue; idempotency key `ACCOUNTING:{businessId}:{module}:{type}:{id}:{event}:{version}`.

**Preferred EIS boundary:** extend finalize tx to also write EIS snapshot + EIS outbox **after** posting success, still before commit; transmit async.

Current EIS submit is outside this engine — **must change**.

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
