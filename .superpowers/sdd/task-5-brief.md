### Task 5: Import step (CSV / Excel)

**Files:**
- Create: `components/payments/reconcile/ImportStep.jsx`
- Modify: `components/payments/reconcile/reconApi.js`
- Modify: `components/payments/reconcile/ReconcileWizard.jsx`

**Interfaces:**
- Consumes: `POST /api/bank-reconciliation/import/preview` (multipart)
- Consumes: `POST /api/bank-reconciliation/import/confirm`
- Accept: `.csv`, `.xlsx`, `.xls` only

- [ ] **Step 1: Wire preview/confirm**

Follow patterns in legacy `app/bank-reconciliation/page.js` (file input â†’ FormData with `reconciliationId` + file â†’ show preview rows â†’ confirm).

Reject OFX in UI (`accept=".csv,.xlsx,.xls"` + client check on extension).

- [ ] **Step 2: On confirm success**

Advance wizard to Match; refresh workspace via `GET /api/bank-reconciliation/reconciliations/[id]`.

- [ ] **Step 3: Commit**

```bash
git add components/payments/reconcile
git commit -m "feat(payments): CSV/Excel statement import in guided reconcile"
```

---
