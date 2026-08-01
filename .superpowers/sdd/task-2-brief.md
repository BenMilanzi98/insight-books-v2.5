### Task 2: Client helper + Quotation/Invoice/POS pickers

**Files:**
- Create: `lib/taxTypesClient.js`
- Modify: `components/QuotationModal.js` (replace `fetch('/api/tax-types')` used for picker load)
- Modify: `components/InvoiceModal.js` (same)
- Modify: `app/pos/page.js` (replace `fetch('/api/tax-types?status=Active')` with helper)

**Interfaces:**
- Produces: `export async function fetchActiveTaxTypes()` → `Promise<array>` of tax type objects from JSON `taxTypes` or array body (match existing API response shape used by modals).

- [ ] **Step 1: Implement client helper**

```js
export async function fetchActiveTaxTypes() {
  const response = await fetch('/api/tax-types?status=Active');
  if (!response.ok) {
    throw new Error(`Failed to load tax types: ${response.statusText}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : data.taxTypes || data.data || [];
}
```

- [ ] **Step 2: Wire QuotationModal**

Replace picker loads of `fetch('/api/tax-types')` with `fetchActiveTaxTypes()` (import from `@/lib/taxTypesClient`). Leave create-tax `POST /api/tax-types` unchanged.

- [ ] **Step 3: Wire InvoiceModal** — same as QuotationModal.

- [ ] **Step 4: Wire POS** — use `fetchActiveTaxTypes()` for the Active list load.

- [ ] **Step 5: Manual check** — open Quotation modal with an Inactive tax in DB; it must not appear in checkboxes.

---

