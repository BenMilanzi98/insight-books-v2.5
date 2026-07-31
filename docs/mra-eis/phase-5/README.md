# Phase 5 — MRA EIS Database & Domain Foundation

**Decision:** see `PHASE_5_READINESS_DECISION.md` → **READY_FOR_PHASE_6_WITH_BLOCKERS**

## What this phase owns
Tenant-safe persistence for terminals, credential **references**, configuration snapshots, mappings, fiscal sequences/allocations, immutable snapshots, transmissions/attempts/responses, receipt projections, VAT5, offline queue (gated), reconciliation, sync runs, manual review, alert state, and EIS transactional outbox.

## Module
- Domain: `lib/mraEis/domain/`
- Services: `lib/mraEis/application/services/`
- Outbox: `lib/mraEis/infrastructure/outbox/`
- Migration: `prisma/migrations/20260722230000_mra_eis_phase5_foundation`

## Hard boundaries respected
- No MRA network I/O
- No real JWT / terminal secret / TAC storage (vaultReference placeholders only)
- No fiscal receipt labelled MRA validated
- Offline creation blocked unless `offlineCertified`
- Fiscal algorithm version `UNVERIFIED_PHASE5` (not MRA-certified)

---
*Phase 5 implementation. No MRA API calls. No terminal activation. No plaintext credentials. No posted Journals/Sales/Stock mutated.*
