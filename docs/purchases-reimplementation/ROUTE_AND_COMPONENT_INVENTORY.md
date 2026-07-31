# Route and Component Inventory

## Navigation

| Label | Href | Permission (Sidebar) | Classification |
|-------|------|----------------------|----------------|
| Suppliers | `/purchases/suppliers` | `suppliers.view` | `REUSE` |
| Orders | `/purchases/orders` | `purchases.view` | `REUSE` |
| Receipts | `/purchases/receipts` | `purchases.view` | `REUSE` |
| Bills | `/purchases/bills` | `purchases.view` | `REUSE` |
| Payments | `/purchases/payments` | `purchases.view` | `REUSE` |

Also present (legacy / parallel):

| Route | Notes | Classification |
|-------|-------|----------------|
| `/suppliers`, `/suppliers/[id]`, `/suppliers/reports` | Older supplier surfaces | `CONSOLIDATE` into purchases hub |
| No `/purchases` dashboard index | Missing | `INCOMPLETE` |
| No matching / reconciliation centre routes | Missing | `INCOMPLETE` |

Page access (`lib/tenantPageAccess.js`): `/purchases` anyOf purchases/suppliers/inventory/stock view — broader than sidebar.

---

## App pages

| Path | Role | Classification |
|------|------|----------------|
| `app/purchases/suppliers/page.js` | Supplier list/hub | `REFACTOR` |
| `app/purchases/suppliers/[id]/page.js` | Supplier detail | `EXTEND` (tabs incomplete vs prompt) |
| `app/purchases/orders/page.js` | PO list + create | `EXTEND` |
| `app/purchases/receipts/page.js` | GR list + create | `EXTEND` |
| `app/purchases/bills/page.js` | Bill list + create | `EXTEND` |
| `app/purchases/payments/page.js` | Payment list + create | `EXTEND` |

**Missing UI (prompt):** purchases dashboard, three-way match screen, reconciliation centre, returns/credit notes, approval inboxes, GRNI aging widgets.

---

## Components

| Path | Notes | Classification |
|------|-------|----------------|
| `components/purchases/SupplierForm.js` | Create/edit supplier | `EXTEND` |
| `components/purchases/SupplierExpenseSelect.js` | Expense account picker | `REUSE` |
| `components/purchases/SupplierSelect.js` | Appears unused by current pages | `DUPLICATED` / dead |

Large logic lives **inline in page.js files** (orders/receipts/bills/payments) — `REFACTOR` into shared workflow components later.

---

## API routes (`app/api/purchases`)

| Route | Methods (typical) | Classification |
|-------|-------------------|----------------|
| `suppliers/route.js` | GET/POST | `EXTEND` |
| `suppliers/[id]/route.js` | GET/PUT/DELETE | `EXTEND` |
| `suppliers/bulk/route.js` | bulk | `EXTEND` / audit |
| `suppliers/[id]/transactions/route.js` | GET | `EXTEND` |
| `suppliers/[id]/expenses/route.js` | GET | `DISCONNECTED` from pure P2P |
| `orders/route.js` | GET/POST | `EXTEND` |
| `orders/[id]/route.js` | GET/PUT/PATCH | `EXTEND` — status transitions ad hoc |
| `orders/[id]/upload/route.js` | upload | `EXTEND` |
| `orders/export/route.js` | export | `DISCONNECTED` from UI often |
| `receipts/route.js` | GET/POST | `EXTEND` |
| `receipts/export/route.js` | export | `DISCONNECTED` |
| `bills/route.js` | GET/POST | `EXTEND` |
| `bills/[id]/route.js` | GET/PUT | `EXTEND` |
| `bills/export/route.js` | export | `DISCONNECTED` |
| `payments/route.js` | GET/POST | `EXTEND` |
| `payments/export/route.js` | export | `DISCONNECTED` |

API access gate (`lib/tenantApiAccess.js`): `/api/purchases` anyOf `purchases.view|create|update|delete`.

**Missing APIs (prompt):** match, reverse receipt, reverse bill, returns, credit notes, duplicate-supplier detect/merge, reconciliation checks, approval commands, GRNI reports.

---

## Workers / jobs

| Area | Finding | Classification |
|------|---------|----------------|
| GR inventory apply | `inventoryAppliedAt` + scheduled paths referenced in schema comments | `EXTEND` — verify worker retry uniqueness |
| Dedicated purchases workers | No dedicated P2P worker module found in audit | `INCOMPLETE` |

---

## Summary counts

- **Nav items audited:** 5  
- **Purchase app pages:** 6  
- **Purchase API route files:** 16  
- **Dedicated purchase components:** 3 (1 likely unused)  
- **Match / dashboard / returns routes:** 0  
