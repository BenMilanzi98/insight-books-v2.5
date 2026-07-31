# Requirement Traceability Matrix

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

| Arch decision | Phase 1 evidence | Phase 2 evidence | Conditional? |
|---|---|---|---|
| Bounded context MraEis | Contract pack | Handover | No |
| Two-level entitlement | Master prompt | EIS_ENTITLEMENT_READINESS | Fix hasEISAccess |
| EligibleSaleFinalized | Sales contract | Event candidates | No |
| Snapshot+Outbox in finalize tx | Idempotency/timeout research | Outbox undrained; post-commit EIS | Need dispatcher |
| No MRA call in financial tx | Principles | POS/Invoice audit | No |
| Server-only credentials | Auth/crypto research | SECRET_MANAGEMENT | Encrypt settings.token |
| Fiscal sequence DB lock | Fiscal numbering contract | Multi-replica risk | Algorithm KAT blocked |
| Unknown outcome reconcile | Last-online research | Retry audit | No |
| x-eis-message-hash | Absent OpenAPI | — | **BLOCKED** |
| Offline signing | Offline KAT missing | PARTIALLY_READY | **BLOCKED** |
| SaaS MAC/terminal | Clarification Q-017–19 | Identity audit | **BLOCKED** |
| Receipt pending≠validated | Receipt/QR requirements | QR = /verify | No |
| No historical auto-submit | Certification/migration | Data assessment | No |
| Corrections only via verified APIs | Credit/void endpoints | Void/refund no EIS | Partial |

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
