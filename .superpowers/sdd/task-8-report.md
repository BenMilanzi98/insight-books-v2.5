# Task 8 Report: Smoke Verification

## Status

Pass with one environment caveat.

- The required Vitest subset passed: `8/8` files, `24/24` tests.
- A rolled-back Prisma smoke was executed successfully against the local database.
- No invoice/payment/product/client data from the smoke was left behind.

## Commands Run

```bash
npx vitest run test/coaDeferredRevenuePurpose.test.js test/invoiceDeferredRevenue.test.js test/invoiceIssueDeferredRevenueTemplate.test.js test/invoiceRevenueRecognitionAdapter.test.js test/ensureInvoiceSalesAccounting.test.js test/ensureInvoicePaymentRevenueRecognition.test.js test/invoicePartialPaymentSalesAccounting.test.js test/paymentReversalSourceTypes.test.js

node .cursor/tmp-task8-smoke.cjs
```

## Local Smoke Method

- Target tenant: `Bytedge Solutions`
- Approach: create a temporary Pending invoice, stocked product, and two payments inside a single Prisma transaction, then intentionally roll the transaction back after collecting evidence.
- Temporary CoA purpose mappings were injected inside that same transaction only because the local tenant did not have `DEFERRED_REVENUE` configured for V2 posting. Those mapping changes were also rolled back.

## Smoke Evidence

### 1. Pending inventory invoice on issue

Observed on the rolled-back smoke invoice (`subtotal 1000`, `VAT 180`, `total 1180`):

- `Invoice` journal posted with:
  - Dr `1200 Accounts Receivable` = `1180`
  - Cr `2150 Deferred Revenue` = `1000`
  - Cr `2120 VAT Payable (MRA)` = `180`
- `Invoice-COGS` journal posted with:
  - Dr `5110` = `400`
  - Cr `1310` = `400`
- `Product Sales` / sales revenue credit on issue: `0`
- Stock moved from `10` to `9`

Result: acceptance point 1 satisfied.

### 2. Partial payment

First payment: `590`

- `Payment` journal posted:
  - Dr `1110 Cash` = `590`
  - Cr `1200 AR` = `590`
- `Invoice-Revenue` journal posted:
  - Dr `2150 Deferred Revenue` = `500`
  - Cr `4100 Product Sales` = `500`
- Revenue recognition result returned `recognizedNet = 500`

Result: acceptance point 2 satisfied.

### 3. Final payment

Second payment: `590`

- Second `Payment` journal posted:
  - Dr `1110 Cash` = `590`
  - Cr `1200 AR` = `590`
- Second `Invoice-Revenue` journal posted:
  - Dr `2150 Deferred Revenue` = `500`
  - Cr `4100 Product Sales` = `500`

Derived totals after both payments:

- Deferred remaining: `0`
- AR remaining: `0`
- Cumulative credited sales revenue: `1000`
- Expected invoice net: `1000`

Result: acceptance point 3 satisfied.

### 4. Dashboard revenue proxy

Using `4100 Product Sales` movement as the proxy:

- After issue: `0`
- After partial payment: `500`
- After final payment: `1000`

Result: acceptance point 4 satisfied.

### 5. Legacy invoice skip

A real local legacy invoice was found: `INV-10082026-00002`.

Inside the rolled-back transaction, a temporary payment was attached to that invoice and `ensureInvoicePaymentRevenueRecognition()` was invoked.

Observed:

- Function returned `skipped: legacy_accrual`
- No `Invoice-Revenue` journal was created for that payment

Result: acceptance point 5 satisfied with live DB evidence.

## Additional Notes

- Re-running `ensureInvoiceSalesAccounting(..., force: true)` before each payment was idempotent:
  - `postedInvoice: false`
  - `postedCogs: false`
  - `stockDeducted: false`
- This matches the intended payment-path behavior where issue/COGS are backfilled only once.

## Concerns / Caveats

- The local tenant is missing a persistent V2 mapping for `DEFERRED_REVENUE`; the smoke only succeeded after adding temporary in-transaction mappings for:
  - `CASH_ON_HAND`
  - `ACCOUNTS_RECEIVABLE`
  - `VAT_OUTPUT`
  - `DEFERRED_REVENUE`
  - `SALES_REVENUE`
  - `INVENTORY`
  - `COST_OF_SALES`
- Because those mappings were rolled back, the smoke proves the posting logic works against the local DB schema and account set, but it also exposes a local environment readiness gap if you expect this tenant to post deferred revenue flows without temporary setup.

## Cleanup

- Smoke invoice/product/client/payments were created inside a rolled-back transaction.
- No persistent business rows from the smoke were kept.
- Temporary script can be removed after reporting.

## Post-smoke fix: DEFERRED_REVENUE legacy fallback

Local tenant invoice posting failed without an injected CoA V2 mapping because `DEFERRED_REVENUE` was missing from the legacy resolution path (unlike `VAT_OUTPUT`). Added `DEFERRED_REVENUE: '2150'` to `LEGACY_MAPPING_CODES` and `DEFERRED_REVENUE: 'DEFERRED_REVENUE'` to `PURPOSE_BY_LEGACY_KEY` so `resolvePurposeAccount` falls back to account code 2150 when no ACTIVE mapping exists and `CANONICAL_MAPPINGS` is off. Extended `test/coaDeferredRevenuePurpose.test.js` to assert the wiring.
