### Task 4: Tax Codes Activate / Deactivate UX

**Files:**
- Modify: `app/tax-types/page.js`

- [ ] **Step 1: Add `toggleTaxStatus(tax)` that PUTs `{ status: tax.status === 'Active' ? 'Inactive' : 'Active' }`**

- [ ] **Step 2: In the table Actions column, add button:**
  - If Active → “Deactivate” (confirm: “This tax will no longer appear on quotations, invoices, or POS.”)
  - If Inactive → “Activate”

- [ ] **Step 3: Refresh list after success; show toast/alert on failure**

- [ ] **Step 4: Manual check** — Deactivate a tax → disappear from Invoice modal after reload; Activate → reappear.

---

