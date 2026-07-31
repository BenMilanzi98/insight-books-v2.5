# Future Transmission State Requirements

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

Statuses: NOT_REQUIRED · PENDING · QUEUED · SENDING · UNKNOWN_OUTCOME · ACCEPTED · REJECTED · RETRY_SCHEDULED · MANUAL_REVIEW_REQUIRED · OFFLINE_SIGNED · BLOCKED

**Preferred:** separate EIS transmission aggregate; derived status on Sale/Invoice UI.

Do not overload Sale.status / Invoice.status with MRA outcomes.

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
