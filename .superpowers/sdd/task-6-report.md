# Task 6 Report

## Status
- Implemented `ensureInvoicePaymentRevenueRecognition` in `lib/ensureInvoicePaymentRevenueRecognition.js`.
- Wired `app/api/invoices/partial-payment/route.js` to call the helper after `postCustomerPaymentAccounting`.
- Added TDD coverage in `test/ensureInvoicePaymentRevenueRecognition.test.js`.
- Updated `test/invoicePartialPaymentSalesAccounting.test.js` for the new route wiring.

## Behavior
- Skips revenue recognition when the invoice issue journal is missing.
- Skips legacy accrual invoices when the issue journal already credits Sales Revenue (`SALES_REVENUE` mapping, subtype, or account code `4100`).
- Skips duplicate recognition for payments that already have an `Invoice-Revenue` journal.
- Uses pro-rata recognition for partial payments and `computeFinalPaymentRecognizedNet` when the remaining balance after the current payment is within `MONEY_TOLERANCE`.

## Verification
- Red phase captured:
  - missing helper module
  - missing route wiring assertion
- Green phase passed:
  - `npm test -- test/ensureInvoicePaymentRevenueRecognition.test.js test/invoicePartialPaymentSalesAccounting.test.js test/invoiceDeferredRevenue.test.js`
  - `npm test -- test/ensureInvoicePaymentRevenueRecognition.test.js test/invoicePartialPaymentSalesAccounting.test.js test/invoiceDeferredRevenue.test.js test/ensureInvoiceSalesAccounting.test.js test/invoiceRevenueRecognitionAdapter.test.js`
- `ReadLints` reported no linter errors in the touched files.

## Concerns
- No functional blockers found.
- One transient Vitest timeout appeared on the first combined run of the adjacent suite, but the isolated adapter file and the full rerun both passed cleanly.

## Commits
- None

## Reviewer Fixes
- Strengthened `test/invoicePartialPaymentSalesAccounting.test.js` to assert source call order using `indexOf` comparisons:
  - `ensureInvoiceSalesAccounting` before `tx.payment.create`
  - `postCustomerPaymentAccounting` before `ensureInvoicePaymentRevenueRecognition`
  - `ensureInvoicePaymentRevenueRecognition` after `postCustomerPaymentAccounting`
- Kept the existing `toContain(...)` checks in place.
- Added quick unit coverage for helper skip cases:
  - `no_issue_journal`
  - `already_posted`
- Re-ran:
  - `npx vitest run test/invoicePartialPaymentSalesAccounting.test.js test/ensureInvoicePaymentRevenueRecognition.test.js`
- Result: 2 files passed, 7 tests passed.
