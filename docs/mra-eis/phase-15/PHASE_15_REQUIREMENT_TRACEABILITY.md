# Phase 15 Requirement Traceability

| Requirement | Trace |
|---|---|
| Reconcile-first | `retryPolicyRegistry.js` + sales-transmission blind-retry 409 |
| Last Online contract | `lastTransactionContractRegistry.js` |
| Absence not conclusive | `absenceIsConclusive: false` + comparator TARGET_NOT_RETURNED |
| Dispatch certainty | `dispatchCertainty.js` |
| Local evidence checksum | `localEvidence.js` |
| Comparator / decimals | `localMraComparator.js` |
| Acceptance recovery | `reconciliationOrchestrator.js` → RECONCILED_ACCEPTED + Phase 14 outbox |
| Safe retry | `controlledSafeRetry.js` + `retryScheduler.js` |
| Sequence never backwards | `sequenceReconciliation.js` |
| Circuit breaker probes | `circuitBreaker.js` — no Sales probes |
| Missing receipt recovery | `missingEvidenceRecovery.js` |
| Typed errors | `reconciliationErrors.js` |
| API / UI | `/api/mra-eis/reconciliation`, settings reconciliation page |

---
*Phase 15 implementation. RECONCILE FIRST — DO NOT RETRY unknown outcomes. Timeout/HTTP 500/worker crash ≠ not processed. Absence from Last Online (single latest) is not conclusive. Safe retry reuses the same Transmission, Fiscal Snapshot and fiscal number; creates a new append-only Attempt only. No Journal/Stock Movement. No Snapshot/Response/Receipt mutation. No credentials/BAC. Live Last Online + Last Offline blocked until verified/certified. Production offline mode never auto-enabled.*
