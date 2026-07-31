# Phase 13 Gap Register

| ID | Gap | Status |
|---|---|---|
| G13-001 | x-eis-message-hash algorithm (Q-010/Q-011) | REQUIRES_MRA_CLARIFICATION |
| G13-002 | Live application success-code catalogue | REQUIRES_MRA_CLARIFICATION |
| G13-003 | Duplicate Sales semantics | REQUIRES_MRA_CLARIFICATION |
| G13-004 | Production fiscal number (G12-001) | BLOCKED |
| G13-005 | VAT5 / Buyer Authorization live | BLOCKED |
| G13-006 | Live sandbox Sales enablement | BLOCKED until G13-001/002 |
| G13-007 | Full Prometheus metrics fan-out | INSUFFICIENT |
| G13-008 | System cross-tenant admin console | WRAP (tenant UI done) |
| G13-009 | Aggressive automatic retry scheduler | DEFERRED Phase 15 |

---
*Phase 13 implementation. Online Sales transmission over immutable fiscal snapshots. HTTP 200 alone is not acceptance. Production/live sandbox blocked until x-eis-message-hash and success codes verified. No QR image or final fiscal receipt. No Journal/Stock Movement. Legacy eisService.submitInvoice disabled (410) unless MRA_EIS_ALLOW_LEGACY_DIRECT_SALES=1.*
