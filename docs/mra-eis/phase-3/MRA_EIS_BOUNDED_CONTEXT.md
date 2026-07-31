# MRA EIS Bounded Context

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

## Name

**MraEis** (module path proposal: `lib/mraEis/` + `app/api/mra-eis/` — adapt to repo conventions).

## Owns

Entitlements · Business EIS settings · Terminals · Credential references · Config snapshots · Sites/mappings · External product catalogue copies · Product/tax/payment mappings · Fiscal sequences · Snapshots · Transmissions/attempts/responses · Receipt EIS projections · Offline queue · Reconciliation · Certification records · EIS read models/reports

## Does not own

Customer · Product · Sale · Invoice · Payment · Inventory · StockMovement · Journal · GL · Trial Balance · local Tax accounting

## Anti-corruption

- Inbound: `EligibleSaleFinalized` from POS/Invoice adapters (local IDs + frozen totals).
- Outbound: versioned `MraEisClient` maps snapshot → MRA DTO; MRA DTO never becomes Sale model.
- Accounting: references `journalEntryId` / registry identity only; never calls posting engine for EIS retries.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
