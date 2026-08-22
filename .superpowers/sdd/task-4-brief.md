### Task 4: Guided wizard shell + statement step

**Files:**
- Create: `app/payments/reconcile/[paymentAccountId]/page.js`
- Create: `components/payments/reconcile/ReconcileWizard.jsx`
- Create: `components/payments/reconcile/StatementStep.jsx`
- Create: `components/payments/reconcile/reconApi.js` (thin fetch helpers)

**Interfaces:**
- Consumes: `POST /api/bank-reconciliation/reconciliations`
- Consumes: `GET /api/bank-reconciliation/reconciliations?paymentAccountId=`
- Consumes: `GET /api/bank-reconciliation/accounts`
- Produces: open/create recon â†’ `reconciliationId` for later steps

- [ ] **Step 1: API helper**

`components/payments/reconcile/reconApi.js`:

```js
export async function reconFetch(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Request failed (${res.status})`);
  return data;
}

export function listReconciliations(paymentAccountId) {
  return reconFetch(
    `/api/bank-reconciliation/reconciliations?paymentAccountId=${encodeURIComponent(paymentAccountId)}`
  );
}

export function createReconciliation(body) {
  return reconFetch('/api/bank-reconciliation/reconciliations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
```

- [ ] **Step 2: StatementStep**

Form fields: period start, period end, opening balance, closing balance.  
On submit:

1. `listReconciliations` â€” if any status in open set, offer Continue (set active id).
2. Else `createReconciliation({ paymentAccountId, statementDate: periodEnd, periodStart, periodEnd, statementOpeningBalance, statementClosingBalance })`.

- [ ] **Step 3: Wizard shell**

`ReconcileWizard.jsx` holds step index + `reconciliationId` + workspace refresh.  
Page loads account name from `/api/bank-reconciliation/accounts` (filter by id) or payment-accounts API.

Steps array: `statement | import | match | resolve | complete`.

- [ ] **Step 4: Smoke**

Navigate from CTA â†’ statement form creates/resumes recon.

- [ ] **Step 5: Commit**

```bash
git add app/payments/reconcile components/payments/reconcile
git commit -m "feat(payments): guided reconcile wizard shell and statement step"
```

---
