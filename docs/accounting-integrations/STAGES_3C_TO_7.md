# Stages 3C–7 — Remaining Module Cutover

Executed per `REMAINING_STAGES_PLAN.md`.

## Stage 3C — Banking leftovers
- `BANK_TRANSFER_POSTED` enum + ACTIVE `BANK_TRANSFER` template
- Payment transfers → `postBankTransferAccounting`
- POS cash deposit → GL when PaymentAccount has `coaAccountId` (keeps payment-account balances)
- Supplier credit → ACTIVE template + `postSupplierCreditAccounting` (ready; no API yet)

## Stage 4 — Payroll
- Enhanced payroll + salary advances → `postPayrollAccounting` / `PAYROLL_POSTED`
- Process→expense path remains Stage 1 expense cutover (avoid enabling both NEW_ENGINE for Payroll and Expense on the same economic event)

## Stage 5 — Fixed assets
- Asset acquire → `postGlEntry` + `postAssetAcquiredAccounting` (Transaction bypass removed)
- Depreciation schedule → also posts `DEPRECIATION_POSTED` GL
- Disposal → template ACTIVE; UI/API scaffold until disposal posts lines

## Stage 6 — Loans / equity / tax
- Liability create → `LOAN_RECEIVED` (sourceType normalized to `Liability`)
- Liability repayment → `postGlEntry` cutover (JE-only bypass removed)
- Capital contribution (init + contributions) → `CAPITAL_CONTRIBUTION_POSTED`
- Payment adjustment → capital contribution cutover
- Tax settlement → `TAX_SETTLEMENT_POSTED`
- Owner drawing / dividend templates ACTIVE; adapters ready

## Stage 7 — Imports / jobs
- Historical sales/expenses batch-upload already use Stage 1–3 adapters
- Deferred goods-receipt cron already uses Stage 3A
- POS cash-day cron closes days only; deposits use Stage 3C when users deposit
- No operational payment webhooks posting GL yet — hook: call customer-payment / bank-transfer adapters with provider event id as `sourceId`

## UI-pending only (`scaffolds.js`)
Dividend declare/pay, asset disposal API, owner drawing UI.
