### Task 7: Reversal coverage for Invoice-Revenue

**Files:**
- Modify: `lib/accountingV2/application/reverseSourceJournals.js` and/or invoice payment reversal / void paths that already reverse `Payment`
- Grep callers: `reverseSourceJournals`, invoice void/refund, payment reversal
- Test: extend existing reversal test or add `test/invoiceRevenueRecognitionReversal.test.js` (static: void/refund includes `Invoice-Revenue` in source types list)

**Interfaces:**
- When reversing a payment, also reverse journals with `sourceType: 'Invoice-Revenue'` and `sourceId: paymentId`
- Invoice void that reverses `Invoice` already reverses issue lines (now Deferred + VAT); ensure no assumption that credits were Sales Revenue in description-only logic

- [ ] **Step 1: Grep and write failing static/unit test** that payment reverse includes Invoice-Revenue

- [ ] **Step 2: Implement minimal extension**

- [ ] **Step 4: PASS**

---
