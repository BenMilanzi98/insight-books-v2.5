# Phase 15 Gap Register

| ID | Gap | Severity | Status |
|---|---|---|---|
| G15-001 | Live sandbox Last Online contract unverified | HIGH | OPEN — query blocked |
| G15-002 | Production Last Online contract unverified | CRITICAL | OPEN — query blocked |
| G15-003 | Last Offline blocked until certified offline | HIGH | OPEN — Phase 16 |
| G15-004 | Duplicate response semantics need MRA clarification | HIGH | OPEN — conservative classification |
| G15-005 | Carry-forward G13 message-hash / success-code | HIGH | OPEN |
| G15-006 | Production receipt/QR still gated (Phase 14) | HIGH | OPEN |
| G15-007 | Full approval workflow UI for production retry | MEDIUM | Foundation; production requires approval flag |
| G15-008 | Legacy blind-retry history migration breadth | MEDIUM | Dry-run plan; Phase 19 owns broad migration |

---
*Phase 15 implementation. RECONCILE FIRST — DO NOT RETRY unknown outcomes. Timeout/HTTP 500/worker crash ≠ not processed. Absence from Last Online (single latest) is not conclusive. Safe retry reuses the same Transmission, Fiscal Snapshot and fiscal number; creates a new append-only Attempt only. No Journal/Stock Movement. No Snapshot/Response/Receipt mutation. No credentials/BAC. Live Last Online + Last Offline blocked until verified/certified. Production offline mode never auto-enabled.*
