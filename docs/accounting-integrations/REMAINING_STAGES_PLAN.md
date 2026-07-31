# Remaining Stages Plan (execute-all)

After Stages 1–3B, wire every remaining live GL path through cutover.
Where ops UI does not exist yet, ship ACTIVE templates + adapters + helpers
so NEW_ENGINE can be enabled when the UI lands.

## Stage 3C — Banking / AP leftovers
- POS cash-day deposit → `BANK_TRANSFER_POSTED` (new enum)
- Payment account transfers → same event
- Supplier credit → adapter + template (ready; no live API yet)

## Stage 4 — Payroll
- Enhanced payroll `postGlEntry` → `PAYROLL_POSTED`
- Salary advances → same module (sourceType `SalaryAdvance`)
- Document: skip duplicate expense GL when payroll already posted

## Stage 5 — Fixed assets
- Asset acquire: kill Transaction bypass → `ASSET_ACQUIRED`
- Depreciation: add GL + `DEPRECIATION_POSTED`
- Dispose: helper + template READY (UI incomplete)

## Stage 6 — Loans / equity / tax
- Liability create → `LOAN_RECEIVED` (fix sourceType `liability_opening`)
- Liability repayment → kill JE bypass → `LOAN_REPAYMENT_POSTED`
- Capital contribution → `CAPITAL_CONTRIBUTION_POSTED`
- Owner drawing / dividend templates ACTIVE (adapters ready)
- Tax settlement → `TAX_SETTLEMENT_POSTED` (new enum)

## Stage 7 — Imports / jobs
- Confirm batch-upload + deferred GR already use Stage 1–3 adapters
- Cron POS cash close stays non-GL; deposit path uses Stage 3C
- No ops payment webhooks yet — document hook point

## Verification
- Expand `accountingV2.integrations.test.js`
- Empty scaffolds (or docs-only remaining)
- Update FINAL_PHASE_9_REPORT + shutdown register
