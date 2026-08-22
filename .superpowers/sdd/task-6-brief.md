### Task 6: Match step (auto + manual 1:N)

**Files:**
- Create: `components/payments/reconcile/MatchStep.jsx`
- Modify: `reconApi.js`, `ReconcileWizard.jsx`

**Interfaces:**
- Consumes: `POST /api/bank-reconciliation/reconciliations/[id]/auto-match`
- Consumes: `GET /api/bank-reconciliation/candidates?reconciliationId=`
- Consumes: `POST /api/bank-reconciliation/matches` body:
  `{ reconciliationId, statementIds: [id], bookLinks: [{ journalEntryLineId, amountMinor? }], notes? }`
- Consumes: match accept/reject actions under `/api/bank-reconciliation/matches/[id]/[action]` if suggestions need accept
- Displays: `guidedStatementStatusLabel` + outstanding list labeled **Outstanding**

- [ ] **Step 1: Layout**

Two columns (or stacked on mobile):

- Left: statement lines with status badges  
- Right: book candidates  

Actions: **Auto Match**, select bank + one/more books â†’ **Match**.

Before POST manual match, client-check sums: `abs(bank.signedAmountMinor) === sum(selected book amounts)` (use workspace field names from API). If mismatch, show error with both totals â€” do not call API.

- [ ] **Step 2: Auto Match**

```js
await reconFetch(`/api/bank-reconciliation/reconciliations/${id}/auto-match`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
});
```

Then refresh workspace; show toast with `matchesCreated` if returned.

- [ ] **Step 3: Commit**

```bash
git add components/payments/reconcile
git commit -m "feat(payments): auto and manual match in guided reconcile"
```

---
