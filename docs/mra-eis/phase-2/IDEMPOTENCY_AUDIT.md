# Idempotency Audit

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

| Path | Protection |
|---|---|
| Accounting V2 | DB unique idempotencyKey |
| POS sale create | UI only |
| Invoice create | Numbering uniqueness, not request id |
| EIS submit | Weak / retries may duplicate |
| Offline sync | Can double-post |

Phase 3 needs unique (tenantId, fiscalNumber), (tenantId, sourceType, sourceId, version), transmission attempt keys.

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
