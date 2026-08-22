### Task 8: Summary + Complete (difference === 0)

**Files:**
- Create: `components/payments/reconcile/SummaryStep.jsx`
- Modify: `ReconcileWizard.jsx`, `reconApi.js`

**Interfaces:**
- Consumes: workspace calculation from `GET .../reconciliations/[id]` (or POST `.../calculate`)
- Consumes: `POST /api/bank-reconciliation/reconciliations/[id]/complete`
- Complete button **disabled** unless `calculation.canComplete === true` OR `differenceMinor === 0` (use server fields; do not invent client plug)

- [ ] **Step 1: Summary strip (also sticky at top of wizard once recon exists)**

Show:

- Bank opening / closing  
- InsightBooks (book) balance  
- Total matched / unmatched / outstanding (from workspace counts)  
- Difference  
- Status text: if complete â†’ Reconciled  

- [ ] **Step 2: Complete action**

```js
async function complete(id) {
  await reconFetch(`/api/bank-reconciliation/reconciliations/${id}/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  return reconFetch(`/api/bank-reconciliation/reconciliations/${id}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment: 'Guided reconcile complete' }),
  });
}
```

On success: read-only state + link back to `/payments`.

On failure (difference â‰  0 or SoD): show server message.

- [ ] **Step 3: Unit test (client helper optional)**

If you extract `canCompleteFromWorkspace(workspace)`:

```js
export function canCompleteFromWorkspace(ws) {
  const calc = ws?.calculation?.calculation || ws?.calculation || {};
  if (typeof calc.canComplete === 'boolean') return calc.canComplete;
  return Number(calc.differenceMinor) === 0;
}
```

Test in `test/bankReconciliation.guidedEligibility.test.js`.

- [ ] **Step 4: Commit**

```bash
git add components/payments/reconcile test/bankReconciliation.guidedEligibility.test.js
git commit -m "feat(payments): reconcile summary and complete only at zero difference"
```

---
