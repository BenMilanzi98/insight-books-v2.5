### Task 6: Cloud snapshot builder

**Files:**
- Create: `lib/desktop/cloud/snapshot.js`
- Create: `app/api/desktop/snapshot/route.js`
- Create: `test/desktop/snapshot.test.js`

**Interfaces:**
- Produces: `buildDesktopSnapshot({ prisma, tenantId, userId }) → snapshot`

Snapshot shape (exact keys):

```js
{
  version: 1,
  tenantId: string,
  sessionUser: { id, name, email, tenantId, role: { id, name, permissions } },
  tenantSettings: { currencyCode, invoicePrefix, taxEnabled, defaultTaxRate, defaultLanguage },
  customers: Array,      // Client rows for tenant (isActive + archived)
  products: Array,       // Product + quantity + barcodes needed by POS
  taxTypes: Array,       // active tax types
  paymentAccounts: Array,
  openInvoices: Array,   // status not paid/void, include items
  recentPayments: Array, // last 90 days
  posConfig: { cashDay: object|null },
  serverNow: string,
}
```

GET `/api/desktop/snapshot` requires auth + bound device (`deviceId` query param). 403 `NOT_BOUND` otherwise.

- [ ] **Step 1: Write a test that the builder maps prisma results into those keys**

Use a fake prisma returning one client, one product, one tax type. Assert `snapshot.customers[0].id`, `snapshot.products[0].quantity`, `snapshot.version === 1`.

- [ ] **Step 2: Implement queries** (real prisma in `snapshot.js`; keep selects explicit — do not `include: true` the whole graph)

- [ ] **Step 3: Run** `npx vitest run test/desktop/snapshot.test.js` — Expected: PASS

- [ ] **Step 4: Commit** (skip unless asked)

---

