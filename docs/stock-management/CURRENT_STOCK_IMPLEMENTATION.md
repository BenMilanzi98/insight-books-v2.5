# Current Stock Implementation (Forensic)

| Field | Value |
|---|---|
| Date | 2026-07-22 |
| Branch | `v2` |
| Scope | `/stock` + inventory APIs, models, accounting adapters, imports/exports |

---

## 1. Architecture summary

InsightBooks V2 Stock is a **product + FIFO batch** inventory system scoped by **tenant (Business)** and optionally **Branch**. There is **no Warehouse model**. Locations are free-text `Product.location` and/or `InventoryLocation`.

| Concern | Current authority |
|---|---|
| Quantity display | `Product.stockLevel` (projection; often written directly) |
| Cost layers | `InventoryBatch` (FIFO: `qtyPurchased` / `qtyRemaining` / `unitCost` / `expiryDate`) |
| Movement history | `InventoryTransaction` (partial coverage) |
| Valuation fields | `Product.totalStockValue`, `averageCost`, `lastPurchaseCost` |
| Write-off audit | `InventoryExpiryAudit` |
| Transfers | `StockTransfer` (+ optional `StockTransferReceiptNotice` for cross-tenant receive) |
| GL posting | V2 adapters → `executePosting`; legacy `postGlEntry` **fails closed** |

---

## 2. UI routes

| Route | File | Behaviour |
|---|---|---|
| `/stock` | `app/stock/page.js` (~6.7k lines) | Monolith: products, services, transactions, low-stock, transfers, receiving, expiry, bulk import/export, movement report, opening-stock wizard |
| `/stock/transactions` | `app/stock/transactions/page.js` | Redirect → `/stock?tab=transactions` |
| `/stock/low-stock` | `app/stock/low-stock/page.js` | Redirect → `/stock?tab=low-stock` |

**Missing as dedicated routes (prompt targets):** `/stock/import`, `/stock/export`, `/stock/movements`, `/stock/expiry`, dedicated transfer/write-off pages.

### UI components

| Component | Role |
|---|---|
| `components/BulkStockOperations.js` | CSV/Excel bulk upload + template download |
| `components/StockTransfer.js` | Transfer UI |
| `components/ExpiryAlertSystem.js` | Expiry alerts UI |
| `components/Stock/ReceivingModule.jsx` | PO receiving dashboard |
| `components/Stock/ServiceFormModal.js` | Service product form |
| `components/Stock/SkuConflictModal.js` | SKU conflict handling |

### Navigation

- Sidebar: `/stock` under inventory permissions (`inventory.view` / `stock.view`)
- Access: `lib/tenantPageAccess.js`, `lib/tenantApiAccess.js`

---

## 3. API surface

### `/api/stock`

| Endpoint | Role |
|---|---|
| `GET/POST /api/stock` | List / create product (FIFO opening possible) |
| `GET/PUT/DELETE /api/stock/[id]` | Product CRUD; **PUT can write `stockLevel` directly** |
| `GET/POST /api/stock/transactions` | Stock in/out/adjustment |
| `GET /api/stock/export` | CSV export |
| `GET /api/stock/statistics` | Dashboard stats |
| `GET /api/stock/movement-history` | Per-product history |
| `GET /api/stock/receiving` | Open PO / pending receipts |
| `POST /api/stock/upload-image` | Product image |
| `POST /api/stock/restore` | Soft-delete restore |
| `POST /api/stock/batch-delete` | Soft-delete many |
| `GET /api/stock/[id]/usage` | Usage before delete |
| `GET /api/stock/[id]/can-delete` | Delete eligibility |

### `/api/inventory`

| Endpoint | Role |
|---|---|
| `POST /api/inventory/write-off` | Expiry/manual write-off |
| `POST /api/inventory/restock` | Restock after write-off |
| `GET /api/inventory/expiry-alerts` | Near-expiry / expired |
| `POST /api/inventory/expiry-alerts/backfill` | Backfill allocations |

### Transfers / alerts / purchases / reports

| Endpoint | Role |
|---|---|
| `/api/stock-transfers`, `/api/stock-transfers/[id]` | Create / approve / receive / reject |
| `/api/stock-by-branch` | Branch stock view |
| `/api/dashboard/stock-alerts` | Low-stock alerts |
| `/api/dashboard/stock-transfer-receipts` | Cross-tenant notices |
| `/api/purchases/receipts` | Goods receipt → inventory posting |
| `/api/reports/stock-movement` | Movement report |
| `/api/reports/inventory-valuation` | Valuation |
| `/api/reports/inventory-losses` | Losses / write-offs |
| `/api/diagnostics/inventory-reconciliation` | Stored vs FIFO divergence |
| `/api/cogs/*` | COGS recognition helpers |
| `/api/eis/stock` | MRA EIS sync |

---

## 4. Domain services (lib)

| File | Role |
|---|---|
| `lib/fifoCosting.js` | Create/consume FIFO batches; `sourceType`+`sourceId` duplicate guard |
| `lib/stockMovementService.js` | Movement report aggregation |
| `lib/stockTransferService.js` | Transfer FIFO out/in |
| `lib/inventoryWriteOffService.js` | Write-off / restock orchestration |
| `lib/inventoryWriteOffJournal.js` | Dr loss / Cr inventory via V2 adapter |
| `lib/inventoryGlAccount.js` | Resolve Stock On Hand (**1310**) |
| `lib/applyGoodsReceiptInventoryPosting.js` | GR → FIFO + txn + GL |
| `lib/cogsIntegration.js` | Sale/invoice COGS + qty decrement |
| `lib/expiryAlertsService.js` | Expiry alert queries |
| `lib/expiryAllocations.js` | Multi-expiry allocation payloads |
| `lib/stockValuationAggregate.js` | Valuation math |
| `lib/tenantStockAccess.js` | Cross-tenant access |
| `lib/openingBalanceService.js` | Opening stock GL |
| V2 adapters | `stockAdjustmentAdapter`, `goodsReceivedAdapter`, `costOfSalesAdapter` |

---

## 5. Database models (Prisma)

| Model | Purpose |
|---|---|
| `Product` | Item master; `stockLevel`, costs, accounts, perishable flags |
| `ProductBarcode`, `ProductUnit`, `ProductTax` | Supporting item data |
| `InventoryCategory` | Tenant categories |
| `InventoryLocation` | Named locations (not warehouses) |
| `InventoryTransaction` | Movement ledger (limited fields vs prompt target) |
| `InventoryBatch` | FIFO / expiry layers |
| `InventoryBatchConsumption` | Sale consumption lines |
| `InventoryExpiryAudit` | Write-off / restock audit + journal link |
| `GoodsReceipt` / `GoodsReceiptItem` | Inbound receipts |
| `StockTransfer` | Branch/tenant transfer workflow |
| `StockTransferReceiptNotice` | Destination notice |

**Absent vs prompt:** Warehouse, StockImportBatch/Row, StockWriteOff aggregate, StockAlert, StockCount, normalized name uniqueness, Import clearing accounting mode enum.

---

## 6. Current import / export format

### Import (`BulkStockOperations.js`)

Template is **CSV**, **many columns** (not 4):

- Product Name*, SKU*, Category*, Description, Price*, Cost, Stock Level*, Reorder Point, Location, Supplier, Is Perishable, Expiry Date, Discount, Weight, Dimensions, Barcode, Tags

Upload typically creates/updates products via parent APIs. Matching is **SKU-centric**, not normalized Item Name.

### Export (`GET /api/stock/export`)

CSV columns include SKU, Product Name, Category, Quantity, Reorder Point, Selling Price, Order Price, Location, Status, Margin %, Stock Value, Last Updated — **not** the four-column simple format.

---

## 7. Accounting integration (current)

```
Operational event
  → FIFO / write-off / GR / COGS service
  → V2 adapter (preferred) → executePosting
  → JournalEntry (architectureVersion = ACCOUNTING_V2)
```

| Event | Path |
|---|---|
| Write-off / stock out | `postStockAdjustmentAccounting` |
| Goods receipt | `postGoodsReceivedAccounting` |
| Sale COGS | `postCostOfSalesAccounting` |
| Opening stock | `openingBalanceService` / opening templates |

Inventory GL leaf typically **1310**; loss **5290** / tenant setting.

**Critical gap:** `PUT /api/stock/[id]` quantity edits often **do not** create `InventoryTransaction` or Journals.

---

## 8. Alerts (current)

| Type | Mechanism |
|---|---|
| Low stock | Dashboard + `reorderPoint` / `reorderLevel` comparisons |
| Expiry | `ExpiryAlertSystem` + `/api/inventory/expiry-alerts` |
| Transfer receipt | Dashboard notices |

No durable `StockAlert` entity with OPEN/ACKNOWLEDGED/RESOLVED lifecycle. Risk of duplicate UI alerts.

---

## 9. Transfers (current)

`StockTransfer` is primarily **branch-oriented** within a tenant, with optional **cross-tenant** receive notice when destination product is created. Accounting for **inter-business expense transfer mode** (source Expense / destination Inventory) is **not** implemented as specified in the master prompt.

---

## 10. Tests (current)

| Test | Coverage |
|---|---|
| `test/inventoryWriteOffJournal.test.js` | V2 cutover vs legacy skip |
| `test/stockTransfer.test.js` | Light unit |
| `test/tenantStockAccess.test.js` | Cross-tenant access |
| `test/stockValuationAggregate.test.js` | Valuation math |
| Others | Units, COA inventory rollup |

**Gaps:** 4-column import, WAC math, PUT qty without journal, FEFO sale block, duplicate expiry expense concurrency, inter-business transfer journals.

---

## 11. Strengths to preserve

1. FIFO batch engine with `sourceType`/`sourceId` idempotency.
2. Goods receipt → inventory posting path.
3. V2 adapters for stock adjustment / GR / COGS.
4. Expiry on batches + write-off/restock services.
5. Soft-delete / restore for products.
6. Receiving module tied to purchase orders.
7. Diagnostics endpoint for inventory reconciliation.

---

## 12. Weaknesses requiring remediation

1. Direct `stockLevel` mutation without movements/journals.
2. Import/export columns far from the required 4-column UX.
3. No normalized Item Name matching / duplicate-name policy.
4. Movement ledger incomplete vs quantity changes.
5. No Warehouse abstraction (Branch + location string only).
6. Alert lifecycle not durable/deduplicated.
7. Inter-business transfer accounting incomplete vs Expense Transfer Mode.
8. Monolith `app/stock/page.js` hard to maintain / mobile-harden.
9. Thin automated test coverage for financial inventory invariants.
