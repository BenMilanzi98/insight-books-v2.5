# Stage 1–2 Integration Notes

## Stage 1 — Cash expenses, bank charges, interest

- **Expenses:** `createExpenseJournalEntry` → `postExpenseAccounting`.
  Template `CASH_EXPENSE` v2 ACTIVE. Supports cash/bank credit or AP when
  `supplierId` + `paymentStatus === 'Pending'`.
- **Bank charge / interest:** `POST /api/payments` types `bank_charge` /
  `interest_income` → banking adapters. Registry sourceTypes `BankCharge` /
  `InterestIncome` (not shared with customer `Payment`).

## Stage 2 — AR/AP documents

- **Invoice:** `createInvoiceJournalEntry` → `postInvoiceAccounting`.
  Uses pilot ACTIVE template `CUSTOMER_INVOICE`.
- **Customer payment:** `createInvoicePaymentJournalEntry` with `paymentId`
  from payments route and invoice partial-payment route.
- **Supplier bill:** `finalizeExpenseBill` → `postSupplierBillAccounting`;
  updates `journalEntryId` + supplier balance on V2 authority.
- **Supplier payment:** `createSupplierPaymentEntry` →
  `postSupplierPaymentAccounting`; links `journalEntryId` on V2 authority.

## Templates

v1 catalogue entries remain DEFINITIONS. Stage 1–2 ACTIVE implementations are
registered as **version 2** in `lib/accountingV2/templates/stageTemplates.js`.

## Flags

Use tenant `AcctV2Configuration.defaultPostingMode`:

- Production default: `LEGACY`
- Observe: `SHADOW` (+ `enableShadowAccounting`)
- Cutover: `NEW_ENGINE` + `accountingV2Enabled` flag for that module/event scope

## Out of scope (scaffolded)

POS/COGS, credit notes/refunds, goods receipt, payroll, assets/depreciation,
loans, equity, imports/webhooks — see `scaffolds.js` and Phase 10–12 readiness.
