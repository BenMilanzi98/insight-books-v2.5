# Opening Balance Repair

## Detection

`P6-OPEN-001` flags accounts with BOTH a stored non-zero `openingBalance` field
AND opening-type journal effects (`OPENING_BALANCE_DUPLICATION`, CRITICAL) — the
double-counting mechanism found in Phase 1. Investigation additionally reviews:
duplicate opening journals, openings imported more than once, opening stock +
inventory journal duplication, opening AR/AP without customer/supplier detail,
opening assets/loans without register/schedule entries, opening capital repeated
as a contribution, Opening Balance Equity not cleared, openings in wrong
periods, unbalanced opening batches.

## Repairs by mechanism

| Mechanism | Repair |
|---|---|
| Stored opening field duplicates an opening journal | The canonical ledger (Phase 5) already ignores stored fields — `REPORT_ONLY_REPAIR` for any report still reading the field; the field is preserved as legacy metadata. No journal. |
| Two opening journals for one balance | Identify the authoritative batch; `DUPLICATE_EFFECT_REPAIR` reverses the duplicate opening journal. |
| Opening capital repeated as a capital contribution | `DUPLICATE_EFFECT_REPAIR` on the duplicate event (see `OWNER_CAPITAL_DISCREPANCY_REPAIR.md`). |
| Stored opening value with NO journal support | `UNSUPPORTED_OPENING_BALANCE`: if authoritative migration evidence proves it → approved `MISSING_JOURNAL_REPAIR` opening journal; if not → exception; it never silently enters the canonical ledger either way. |
| Opening journal in wrong period | `PERIOD_ADJUSTMENT_REPAIR`. |

Post-repair verification reconciles the opening Trial Balance and the opening
positions of AR, AP, inventory, assets and loans against their subledgers.
Opening journals are never deleted; migration evidence is preserved.
