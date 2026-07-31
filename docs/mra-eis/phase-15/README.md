# Phase 15 — MRA EIS Retry, Unknown-Outcome Reconciliation & Recovery

**Decision:** `READY_FOR_PHASE_16_WITH_BLOCKERS`

## Entry
- Domain: `lib/mraEis/application/reconciliation/`
- APIs: `/api/mra-eis/reconciliation`
- UI: `/settings/integrations/mra-eis/reconciliation`
- Workers: `processTransmissionReconciliationOutboxBatch`, `processAuthorizedRetryBatch`
- Models: `MraEisTransmissionReconciliation`, `MraEisReconciliationQueryAttempt`, `MraEisRetryAuthorization`, `MraEisCircuitBreaker`
- Migration: `prisma/migrations/20260723020000_mra_eis_phase15_reconciliation`
- Tests: `test/mraEis.phase15.reconciliation.test.js`

## Hard rules
- Reconcile before retry for UNKNOWN_OUTCOME
- Timeout / connection reset / HTTP 500 / worker crash remain ambiguous
- Last Online absence (SINGLE_LATEST) ≠ DEFINITELY_NOT_PROCESSED
- Duplicate ≠ automatic acceptance
- Safe retry: same Transmission + Snapshot + fiscal number; new Attempt only
- No accounting / inventory repost or reverse
- No Snapshot / Response Evidence / original Receipt mutation
- No credentials or Buyer Authorization Code in evidence
- Live Last Online + Last Offline **BLOCKED**
- Maintenance does not enable Offline mode

---
*Phase 15 implementation. RECONCILE FIRST — DO NOT RETRY unknown outcomes. Timeout/HTTP 500/worker crash ≠ not processed. Absence from Last Online (single latest) is not conclusive. Safe retry reuses the same Transmission, Fiscal Snapshot and fiscal number; creates a new append-only Attempt only. No Journal/Stock Movement. No Snapshot/Response/Receipt mutation. No credentials/BAC. Live Last Online + Last Offline blocked until verified/certified. Production offline mode never auto-enabled.*
