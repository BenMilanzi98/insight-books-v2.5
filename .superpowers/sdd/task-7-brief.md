### Task 7: Resolve â€” create Expense / Money in

**Files:**
- Create: `components/payments/reconcile/ResolveStep.jsx`
- Modify: `reconApi.js`

**Interfaces:**
- Consumes: `POST /api/bank-reconciliation/adjust` with:
  ```js
  {
    reconciliationId,
    statementTransactionId,
    classification: 'BANK_CHARGE' | 'INTEREST', // expense vs money-in
    postAdjustment: true,
    offsetAccountId, // expense or income CoA
    description,
  }
  ```
- UI labels: **Create Transaction** â†’ choose Expense (Bank charge) or Money in (Interest / other income)
- After success: refresh workspace (statement should link / classify)

- [ ] **Step 1: UI for unmatched bank rows**

For each unmatched statement line, button **Create Transaction** opens small form:

- Type: Expense | Money in  
- Offset account dropdown (fetch CoA expense/income accounts â€” reuse any existing accounts picker used on expense forms, or `/api/accounts` filtered)  
- Description (default statement description)  
- Submit â†’ adjust API  

Map:

- Expense â†’ `classification: 'BANK_CHARGE'`
- Money in â†’ `classification: 'INTEREST'`

- [ ] **Step 2: Outstanding books**

List outstanding items from workspace; allow leave-as-is (no forced clear). Optional unmatch only if match id available via matches API.

- [ ] **Step 3: Commit**

```bash
git add components/payments/reconcile
git commit -m "feat(payments): create expense or money-in from unmatched bank lines"
```

---
