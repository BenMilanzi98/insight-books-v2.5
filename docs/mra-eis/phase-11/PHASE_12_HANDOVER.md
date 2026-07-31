# Phase 12 Handover

# Phase 12 will implement
- Immutable fiscal snapshot from READY_FOR_FISCAL_SNAPSHOT bridges
- Exact seller/buyer/terminal/config/site/product/tax/levy/payment/totals snapshots
- Fiscal-number allocation (scopes/sequences) — contract still gated
- No duplicate accounting/inventory
- Source-change detection after snapshot lock

## Inputs from Phase 11
- Capability policy, type registry, eligibility policies/decisions
- Bridge state machine + finalization identity + source checksum
- Terminal/config checksums, site/warehouse, product/service/tax/levy/payment resolution results
- Buyer classification, B2B/VAT5 readiness flags (not live validation)
- Outbox event `MRA_EIS_FISCAL_SNAPSHOT_REQUESTED` (references only)
- Accounting/inventory remain external authoritative identities

## Blockers carrying forward
- Split-payment clarification
- VAT5 live validation endpoint
- Virtual Warehouse
- Bundle policy
- Q-003 product sync / Phase 7–8 production crypto gates
- Fiscal-number sequence contract verification

---
*Phase 11 implementation. Local sales eligibility + bridge only. No MRA Sale submission, fiscal number, QR, or “MRA validated” receipt. Bridge creates no Journal/Stock Movement. Customer payments are not Sales. Draft/Quote/Proforma excluded.*
