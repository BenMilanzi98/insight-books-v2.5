### Task 3: API write enforcement

**Files:**
- Modify: `app/api/quotations/route.js` (POST, before itemTaxes create)
- Modify: `app/api/quotations/[id]/route.js` (PUT/PATCH that recreates items)
- Modify: `app/api/invoices/route.js` (POST)
- Modify: `app/api/invoices/[id]/route.js` (PUT that writes item taxes)
- Modify: `app/api/sales/route.js` (before creating sale item tax rows from taxBreakdown)

**Pattern in each write handler (before persisting taxes):**

```js
import {
  assertActiveTaxTypeIds,
  collectTaxTypeIdsFromItems,
} from '@/lib/taxManagement/assertActiveTaxTypes';

try {
  await assertActiveTaxTypeIds(prisma, user.tenantId, collectTaxTypeIdsFromItems(items));
} catch (e) {
  if (e?.status === 400 || e?.code === 'INACTIVE_TAX' || e?.code === 'UNKNOWN_TAX') {
    return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
  }
  throw e;
}
```

For sales, also collect IDs from each `item.taxBreakdown` before insert.

- [ ] **Step 1: Quotations POST + [id] update**
- [ ] **Step 2: Invoices POST + [id] update**
- [ ] **Step 3: Sales POST taxBreakdown path**
- [ ] **Step 4: Verify** — POST quotation with Inactive taxTypeId returns 400 JSON `{ code: 'INACTIVE_TAX' }`

---

