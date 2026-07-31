# Phase 15 Tasks

| Stream | Status |
|---|---|
| Retry/recon dependency audit | DONE |
| Gap register | DONE |
| Disable blind EIS retry paths | DONE (sales-transmission `retry` → 409) |
| Last Online contract re-verify | DONE (mock provisional; live/prod BLOCKED) |
| Last Offline contract | BLOCKED until Phase 16 |
| Contract / Retry / Remediation registries | DONE |
| Reconciliation aggregate + state machine | DONE |
| Local evidence + checksum + validation | DONE |
| Dispatch certainty | DONE |
| Query attempts + mock Last Online | DONE |
| Comparator + match confidence + outcomes | DONE |
| Acceptance / rejection / DNP / duplicate | DONE |
| Safe retry authorization + controlled retry | DONE |
| Auth / config / rate-limit / maintenance / CB | DONE (foundations) |
| Sequence reconciliation (no backward move) | DONE |
| Missing Event / Receipt recovery | DONE |
| Worker + scheduler + API + UI | DONE |
| Permissions | DONE |
| Unit tests | DONE |
| Docs + Phase 16 handover | DONE |
| Live Last Online / Offline queries | BLOCKED |

---
*Phase 15 implementation. RECONCILE FIRST — DO NOT RETRY unknown outcomes. Timeout/HTTP 500/worker crash ≠ not processed. Absence from Last Online (single latest) is not conclusive. Safe retry reuses the same Transmission, Fiscal Snapshot and fiscal number; creates a new append-only Attempt only. No Journal/Stock Movement. No Snapshot/Response/Receipt mutation. No credentials/BAC. Live Last Online + Last Offline blocked until verified/certified. Production offline mode never auto-enabled.*
