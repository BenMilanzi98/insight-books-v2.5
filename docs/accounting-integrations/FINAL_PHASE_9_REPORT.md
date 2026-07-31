# Final Phase 9 Report (complete operational cutover)

## Scope delivered

All live operational GL paths are behind Module Accounting Adapters +
`runCutoverPosting` (LEGACY / SHADOW / NEW_ENGINE). Templates for Stages 1–6
are ACTIVE v2. Default tenant mode remains **LEGACY** until explicitly flipped.

## Stages

| Stage | Status |
| --- | --- |
| 1–2 Expenses, banking charge/interest, AR/AP docs | DONE |
| 3A POS / COGS / GR / stock adj | DONE |
| 3B Credit notes / invoice refunds | DONE |
| 3C Bank transfer / POS cash deposit / supplier credit ready | DONE |
| 4 Payroll + salary advances | DONE |
| 5 Assets acquire + depreciation GL | DONE |
| 6 Loans, capital, tax settlement | DONE |
| 7 Imports/jobs (already on adapters; docs) | DONE |

## New enums
- `BANK_TRANSFER_POSTED`
- `TAX_SETTLEMENT_POSTED`

## Code map
- Adapters: `lib/accountingV2/adapters/**` + `remainingAdapters.js`
- Templates: `stageTemplates.js` + `remainingStageTemplates.js`
- Guard: expanded `LEGACY_SOURCE_SCOPE`
- Tests: `test/accountingV2.integrations.test.js`

## Explicitly deferred (UI missing)
- Dividend declaration/payment workflows
- Asset disposal GL from UI
- Owner drawing dedicated UI (adapter ready)
- Supplier credit note API (adapter ready)
- Ops payment provider webhooks

## Cutover recommendation
1. **DONE** — all tenants flipped to `NEW_ENGINE` (`scripts/activate-new-engine-posting.js`)  
2. LEGACY/SHADOW retained only as explicit rollback  
3. Never enable both `Payroll` and expense-from-process adapters for the same economic event  
