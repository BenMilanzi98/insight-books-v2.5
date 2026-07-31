# Stock Domain Model (Approved Design)

| Field | Value |
|---|---|
| Date | 2026-07-22 |
| Status | **Approved** |
| Costing | **Hybrid (FORK-01 = A)** |
| Location scope | **Business = hidden primary branch** (no user-facing branches) |

---

## Decisions locked

### FORK-01 — Costing (A — Hybrid)

- **Authoritative issue cost / COGS:** FIFO `InventoryBatch` layers (existing).
- **Product valuation display + simple Excel “Order Price”:** Weighted-average cost of remaining layers:
  - `WAC = totalStockValue ÷ quantityOnHand` (exact decimals).
- **Simple import receipt:** Creates one FIFO batch at imported Order Price **and** updates product `averageCost` / `totalStockValue` / `stockLevel` so WAC formula holds.
- Historical batch costs are never rewritten when a later import arrives.

### FORK-04 / Branch policy — Business as default location

- Users **must not** be required to create or select a Branch.
- Every Business (`Tenant`) has one **hidden primary branch** resolved server-side via `resolveHiddenPrimaryBranchId` / `ensurePrimaryBranchForTenant`.
- Stock APIs ignore client-supplied `branchId` for writes (`resolveBranchId` already does this).
- UI copy and new Stock pages treat scope as **Business**, not Warehouse/Branch.
- “Warehouse” in the master prompt maps to this hidden primary location for now.

### FORK-02 — Transfer accounting (default)

- Default: **Expense Transfer Mode** (source Dr Transfer Expense / Cr Inventory; destination Dr Inventory / Cr Clearing).
- Configurable later to Due-To/Due-From.

### FORK-03 — Expiry write-off

- Tenant-configurable auto Job vs manual approval (implementation after import slice).

### FORK-05 — Selling Price on import

- Default: update Item Selling Price from imported Selling Price.
- Optional per-batch opt-out flag on confirm.

---

## Core entities (target)

| Concept | Implementation |
|---|---|
| Item | `Product` (+ `normalizedName`) |
| Location | Hidden primary `Branch` (not user-managed) |
| Batch / Lot | `InventoryBatch` |
| Movement | `InventoryTransaction` (extended fields over time) |
| Import batch | `StockImportBatch` / `StockImportRow` (new) |
| Write-off audit | `InventoryExpiryAudit` (evolve) |
| Transfer | `StockTransfer` (evolve for inter-business GL) |

Projections: `Product.stockLevel`, `totalStockValue`, `averageCost` — rebuildable from batches/movements.

---

## Simple Excel contract

Exactly four columns:

1. Item Name  
2. Quantity  
3. Order Price  
4. Selling Price  

Business from authenticated session tenant. No Branch column.
