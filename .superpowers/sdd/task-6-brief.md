### Task 6: Payment revenue recognition helper + wire partial-payment

**Files:**
- Create: `lib/ensureInvoicePaymentRevenueRecognition.js`
- Modify: `app/api/invoices/partial-payment/route.js`
- Modify: `test/invoicePartialPaymentSalesAccounting.test.js`
- Test: `test/ensureInvoicePaymentRevenueRecognition.test.js`

**Interfaces:**
- Produces: `ensureInvoicePaymentRevenueRecognition({ db, tenantId, userId, invoiceId, paymentId, paymentAmount, hasPermission })`
- Logic:
  1. Load invoice (`total`, `taxAmount`)
  2. Find posted `Invoice` JE for invoice; if none, return `{ skipped: 'no_issue_journal' }` (caller should have run issue ensure first)
  3. If any credit line on that JE is to Sales Revenue account (legacy): return `{ skipped: 'legacy_accrual' }`
  4. If `Invoice-Revenue` already exists for `paymentId`: return `{ skipped: 'already_posted' }`
  5. Sum prior `Invoice-Revenue` totals for this invoice’s payments (or sum recognized nets from journals linked by payment ids on invoice)
  6. If payment settles remaining balance (`remaining after this payment ≤ MONEY_TOLERANCE`): `recognizedNet = computeFinalPaymentRecognizedNet(...)` else `computePaymentRecognizedNet(...)`
  7. Call `postInvoiceRevenueRecognitionAccounting`

**Legacy detection:** load Invoice JE lines with accounts; if any credited account maps to purpose `SALES_REVENUE` or `accountCode === '4100'` (Product Sales), treat as legacy.

Wire `partial-payment/route.js` inside the transaction **after** payment create + `postCustomerPaymentAccounting`:

```js
await ensureInvoiceSalesAccounting({ db: tx, tenantId, userId, invoiceId, force: true });
// create payment + update invoice status...
await postCustomerPaymentAccounting({ ... });
await ensureInvoicePaymentRevenueRecognition({
  db: tx,
  tenantId: user.tenantId,
  userId: user.id,
  invoiceId,
  paymentId: payment.id,
  paymentAmount: numericAmount,
});
```

Update static test:

```js
expect(source).toContain('ensureInvoicePaymentRevenueRecognition');
expect(source).toContain('ensureInvoiceSalesAccounting');
```

- [ ] **Step 1: Failing unit tests** for skip legacy / pro-rata / final payment (mock db + adapter)

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement helper + wire route**

- [ ] **Step 4: Run related vitest files — PASS**

---
