# Stock Data Integrity Report

| Field | Value |
|---|---|
| Date | 2026-07-22 |
| Status | **Code-path forensic only — production-copy scan NOT run** |
| Environment scanned | Repository + Prisma schema + known diagnostics |

---

## 1. Integrity model (target)

| Check | Expected |
|---|---|
| Quantity | Σ Stock Movements (signed) = on-hand projection |
| Value | Σ movement values = valuation projection |
| GL | Inventory Asset GL = inventory valuation (Business/currency) |
| Batch | Σ `InventoryBatch.qtyRemaining` ≈ product on-hand (FIFO mode) |
| Write-off | One active financial event per batch write-off identity |
| Transfer | One source + one destination movement + one journal each |

---

## 2. Known structural integrity risks (code-evidenced)

| ID | Risk | Evidence | Impact | Remediation path |
|---|---|---|---|---|
| STK-DI-001 | Quantity changed without `InventoryTransaction` | `PUT /api/stock/[id]` updates `stockLevel` | Movement report ≠ Product qty | Ban direct edits; force receive/adjust APIs; migration opening movements |
| STK-DI-002 | Quantity/value without Journal | Same PUT path; historical upload API noted | Inventory GL drift | Posting Engine on financial adjust; reconcile diagnostics |
| STK-DI-003 | `stockLevel` vs Σ batch remaining drift | FIFO consume/create races; direct edits | Wrong FEFO / COGS | Rebuild projection from batches + movements |
| STK-DI-004 | `totalStockValue` vs FIFO layers | `GET /api/diagnostics/inventory-reconciliation` | Wrong valuation / WAC export | Rebuild valuation; stop dual writes |
| STK-DI-005 | Duplicate Item names (case/space) | No normalized unique constraint on Product name | Import creates duplicates | Normalize + unique per tenant (policy) |
| STK-DI-006 | Import re-run duplicates stock | Bulk ops create products without file-hash batch | Double qty/value | StockImportBatch idempotency |
| STK-DI-007 | Fractional write-off may skip txn | Write-off service notes whole-unit txn behaviour | Movement incomplete | Always write movement with Decimal qty |
| STK-DI-008 | Expired batch still sellable | Sale/POS may not always filter expiry | Sell expired goods | FEFO + hard block |
| STK-DI-009 | Cross-tenant transfer without dual GL | Transfer service FIFO-only | Missing Expense/Inventory journals | Implement transfer accounting modes |
| STK-DI-010 | Soft-deleted products with residual batches | Soft delete may leave batch qty | Phantom stock | Archive policy + zero check |
| STK-DI-011 | Opening stock double-count | Known repair taxonomy `OPENING_BALANCE_DUPLICATION` | Inflated inventory | Repair + unique opening identity |
| STK-DI-012 | Missing source→journal link | Partial audit fields | Untraceable GL | InventoryAccountingLink / journalId on movements |

---

## 3. Production-copy checks (PENDING)

Run only against approved backup / staging copy. Do **not** invent results.

Suggested SQL / script themes (to implement in `scripts/` later):

1. Products where `stockLevel` ≠ Σ open batch `qtyRemaining` (tenant-scoped).
2. Products with `stockLevel ≠ 0` and zero `InventoryTransaction` rows.
3. Products with `totalStockValue` ≠ Σ (`qtyRemaining * unitCost`) of batches.
4. Duplicate normalized names: `lower(trim(regexp_replace(name,'\s+',' ','g')))` per `tenantId`.
5. Batches with `expiryDate < now()` and `qtyRemaining > 0` and no write-off audit.
6. `InventoryExpiryAudit` write-offs without `journalEntryId`.
7. Stock transfers `status=received` without balancing destination product qty movement.
8. Orphan `InventoryBatch` for deleted products.
9. Negative `stockLevel` / `qtyRemaining` / `totalStockValue`.
10. Cross-tenant productId references on transfers (should be remapped).

**Status:** Scripts and execution results **not yet produced**. Mark STK-DI-* open until measured.

---

## 4. Migration principles (preview)

From master prompt Stage 1–5:

1. Snapshot all Product qty/value/business/branch.
2. Create controlled `MIGRATION_OPENING` / `LEGACY_RECONSTRUCTION` movements where history missing — **do not fabricate operational sales**.
3. Rebuild projections from movements/batches.
4. Reconcile to Inventory GL; unexplained diffs → Finance register, not silent plugs.
5. Preserve original Journals; never rewrite posted GL to force agreement.

Detail plan: `STOCK_DATA_MIGRATION_STRATEGY.md` (to be written after design approval).

---

## 5. Honesty statement

This report documents **structural** integrity risks proven by code paths. It does **not** claim production balances were measured. No production data was modified during this forensic pass.
