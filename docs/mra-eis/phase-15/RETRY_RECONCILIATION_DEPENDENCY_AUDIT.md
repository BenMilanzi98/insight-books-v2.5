# Retry Reconciliation Dependency Audit

| Component | Classification | Notes |
|---|---|---|
| sales-transmission `action=retry` | DISABLE / WRAP | Returns 409; points to Phase 15 |
| Phase 13 `RECONCILE_BEFORE_RETRY` | REUSE | Emits Phase 15 outbox event |
| Phase 13 transmission orchestrator | EXTEND | Rejects UNKNOWN blind retry; allows RETRY_SCHEDULED |
| `reconciliationService.js` (generic runs) | LEGACY_READ_ONLY / WRAP | Not the Phase 15 engine |
| Last Online/Offline adapters | EXTEND | Mock path when contract allows |
| Phase 12 sequence models | REUSE | Reconciliation explains gaps; no auto decrement |
| Phase 14 receipt worker | REUSE | Missing receipt recovery recreates outbox only |
| Queue / Cron blind retries | DISABLE for EIS Sales | Must not resubmit without Phase 15 auth |
| Manual “mark accepted” UI | UNSAFE_STATUS_OVERRIDE | Rejected in recon API client fields |
| Circuit breaker | EXTEND | New `MraEisCircuitBreaker` model |

---
*Phase 15 implementation. RECONCILE FIRST — DO NOT RETRY unknown outcomes. Timeout/HTTP 500/worker crash ≠ not processed. Absence from Last Online (single latest) is not conclusive. Safe retry reuses the same Transmission, Fiscal Snapshot and fiscal number; creates a new append-only Attempt only. No Journal/Stock Movement. No Snapshot/Response/Receipt mutation. No credentials/BAC. Live Last Online + Last Offline blocked until verified/certified. Production offline mode never auto-enabled.*
