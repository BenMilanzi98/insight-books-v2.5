# Phase 19 Handover

Phase 19 owns existing-data assessment and controlled migration (EFD/EIS discovery, dry-run, additive migration, reconciliation before activation).

## From Phase 18
- Admin Centre routes + aggregation services
- Report definition registry + export security model
- Legacy UI audit (unsafe actions remain blocked)
- Read-model rebuild helpers
- Dashboard/report reconciliation helpers

## Must preserve
- Journals, Stock Movements, Sales/Invoices
- Immutable EIS evidence, fiscal numbers, accepted receipts
- Tenant/Business ownership, environment separation, audit history

## Must not
- Automatically transmit historical Sales

---
*Phase 18 implementation. Operational window over Phases 1–17. No fiscal engine duplication. Server-authoritative Tenant/Business/Environment context. Failed queries ≠ zero. Stale data labelled. Commands are intent-only (no arbitrary final states). No Set Terminal Active / Mark Accepted / Clear MRA without evidence. No credentials/JWT/private keys/BAC in UI or exports. Saved views do not grant permissions. Scheduled/export permission rechecked. No Journal/Stock from Phase 18. No historical Sale submission.*
