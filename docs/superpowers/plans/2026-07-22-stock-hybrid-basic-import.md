# Stock Hybrid + Basic 4-Column Import/Export — Implementation Plan

> **For agentic workers:** Use TDD. Complete one task, verify tests, then next.

**Goal:** Ship Hybrid costing (FIFO + WAC display) with Business-scoped 4-column Excel import/export, normalized Item Name matching, Stock Movements on import, and no user-facing branch requirement.

**Architecture:** New `lib/stock/*` services; APIs under `/api/stock/basic-*`; pages `/stock/import` and `/stock/export`. Writes resolve hidden primary branch server-side. Import creates FIFO batch + InventoryTransaction + updates WAC fields; accounting via Posting Engine (opening/import clearing) in a follow-on task if mappings missing.

---

## File map

| File | Responsibility |
|---|---|
| `lib/stock/itemNameNormalization.js` | Normalize + match names |
| `lib/stock/weightedAverageCost.js` | Exact WAC math (minor units) |
| `lib/stock/basicStockWorkbook.js` | Excel template / parse / export (ExcelJS) |
| `lib/stock/basicStockImportService.js` | Preview + confirm + idempotency |
| `lib/stock/basicStockExportService.js` | 4-column export data |
| `app/api/stock/basic-import/template/route.js` | Download template |
| `app/api/stock/basic-import/preview/route.js` | Preview |
| `app/api/stock/basic-import/confirm/route.js` | Confirm |
| `app/api/stock/basic-export/route.js` | Export xlsx |
| `app/stock/import/page.js` | Simple import UI |
| `app/stock/export/page.js` | Simple export UI |
| `prisma/schema.prisma` + migration | `normalizedName`, StockImportBatch/Row |
| `test/stock/*.test.js` | Unit + import invariants |

---

### Task 1: Name normalization + WAC (TDD)

**Files:** `lib/stock/itemNameNormalization.js`, `lib/stock/weightedAverageCost.js`, `test/stock/itemNameNormalization.test.js`, `test/stock/weightedAverageCost.test.js`

- Normalize: trim, collapse whitespace, casefold.
- WAC: `(q0*c0 + q1*c1) / (q0+q1)` with exact decimals; reject negative qty/price.
- Tests: Cooking Oil variants match; import example 10@100 + 5@160 → 15 qty, 1800 value, 120 WAC.

### Task 2: Workbook parse/template/export helpers

**Files:** `lib/stock/basicStockWorkbook.js`, tests

- Headers exactly: Item Name, Quantity, Order Price, Selling Price
- Reject missing columns; skip example row marked EXAMPLE
- Formula cells → displayed value; block formula injection on export

### Task 3: Prisma additive fields

**Files:** schema + migration

- `Product.normalizedName` (nullable then backfill)
- Unique `(tenantId, normalizedName)` where not deleted (partial if possible; else app enforce + index)
- `StockImportBatch`, `StockImportRow` models

### Task 4: Import preview/confirm service

**Files:** `lib/stock/basicStockImportService.js`

- Match within tenant only via normalizedName
- Ambiguous → block row
- Confirm: createFifoBatch + InventoryTransaction + averageCost + price update
- File hash idempotency on StockImportBatch
- branchId = resolveHiddenPrimaryBranchId(tenantId)

### Task 5: APIs + pages

Wire auth, `inventory.import` / `inventory.export` (or existing inventory.create/export), Business from session.

### Task 6: Regression tests + docs update

Update gap register; mark J/K/L/M/N progress.
