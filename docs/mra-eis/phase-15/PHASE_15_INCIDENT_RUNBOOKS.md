# PHASE 15 INCIDENT RUNBOOKS

| Incident | Action |
|---|---|
| UNKNOWN_OUTCOME | Reconcile; never blind retry |
| Timeout | Treat ambiguous; Last Online under contract |
| Accepted recovered | Create Phase 14 event; no Sale |
| MRA ahead | Pause/escalate; no sequence jump |
| Terminal blocked | Stop retries; system remediation |
| Missing receipt | recover-receipts; no resubmit |

---
*Phase 15 implementation. RECONCILE FIRST — DO NOT RETRY unknown outcomes. Timeout/HTTP 500/worker crash ≠ not processed. Absence from Last Online (single latest) is not conclusive. Safe retry reuses the same Transmission, Fiscal Snapshot and fiscal number; creates a new append-only Attempt only. No Journal/Stock Movement. No Snapshot/Response/Receipt mutation. No credentials/BAC. Live Last Online + Last Offline blocked until verified/certified. Production offline mode never auto-enabled.*
