# Phase 12 — Immutable Fiscal Snapshot & Fiscal Numbering

**Decision:** `READY_FOR_PHASE_13_WITH_BLOCKERS`

## Entry
- Domain: `lib/mraEis/application/fiscalSnapshot/`
- Migration: `prisma/migrations/20260722290000_mra_eis_phase12_fiscal_snapshot`
- Models: `MraEisSnapshot` (extended), `MraEisFiscalSequenceScope`, `MraEisFiscalNumberReservation`
- APIs: `/api/mra-eis/fiscal-snapshots`, `/api/mra-eis/fiscal-sequences`
- UI: `/settings/integrations/mra-eis/fiscal-snapshots`
- Worker: `processFiscalSnapshotOutboxBatch` / `claimReadyBridgesForSnapshot`
- Tests: `test/mraEis.phase12.fiscalSnapshot.test.js`
- Outbox handoff: `MRA_EIS_SALES_PAYLOAD_REQUESTED` (references only)

## Hard rules
- No MRA Sales API call in Phase 12
- No QR / MRA acceptance claim
- Snapshot creates no Journal and no Stock Movement
- Authoritative reload from bridge + source (not Outbox body, not browser)
- Completed snapshots immutable
- One completed snapshot per bridge
- Atomic reservation via `FOR UPDATE` — never `MAX+1`
- Production numbering blocked (`REQUIRES_MRA_CLARIFICATION`)
- Offline numbering disabled without certification
- No credentials / Buyer Authorization Code in snapshot or Phase 13 outbox

---
*Phase 12 implementation. Immutable fiscal snapshots + atomic numbering only. No MRA Sale submission, QR, or “MRA validated” claim. Snapshot creates no Journal/Stock Movement. Production fiscal numbers blocked until MRA contract verified. Synthetic sandbox numbers are not MRA fiscal numbers.*
