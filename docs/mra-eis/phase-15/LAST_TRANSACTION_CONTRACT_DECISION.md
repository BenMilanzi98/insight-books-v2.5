# Last Transaction Contract Decision

## Decision matrix

| Endpoint | Environment | Decision | Query |
|---|---|---|---|
| Last Online | MOCK / DEV | PROVISIONAL_SANDBOX_ONLY | ALLOWED |
| Last Online | Live SANDBOX | BLOCKED | BLOCKED |
| Last Online | PRODUCTION | BLOCKED | BLOCKED |
| Last Offline | All | BLOCKED | BLOCKED |

## Critical semantics
- Result cardinality: **SINGLE_LATEST**
- `absenceIsConclusive: false`
- Different latest → RESPONSE_WINDOW_INSUFFICIENT / STILL_UNKNOWN
- Do not infer acceptance from sequence advance alone

---
*Phase 15 implementation. RECONCILE FIRST — DO NOT RETRY unknown outcomes. Timeout/HTTP 500/worker crash ≠ not processed. Absence from Last Online (single latest) is not conclusive. Safe retry reuses the same Transmission, Fiscal Snapshot and fiscal number; creates a new append-only Attempt only. No Journal/Stock Movement. No Snapshot/Response/Receipt mutation. No credentials/BAC. Live Last Online + Last Offline blocked until verified/certified. Production offline mode never auto-enabled.*
