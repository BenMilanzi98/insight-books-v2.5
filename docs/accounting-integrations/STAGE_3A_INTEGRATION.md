# Stage 3A Integration — Core Inventory GL

Scope: POS sale revenue, unified COGS, goods receipt, stock write-off/adjustment.
Scaffolded (not wired): credit notes, customer refunds, POS cash deposit, supplier credits.

## Wired adapters

| Adapter | Event | Entry points |
| --- | --- | --- |
| `posSaleAdapter` | `INVENTORY_SOLD` | `createSaleJournalEntries` |
| `costOfSalesAdapter` | `COST_OF_SALES_RECOGNIZED` | POS COGS branch, `recordCOGSOnSale` (`/api/cogs/sale`), invoice COGS |
| `goodsReceivedAdapter` | `INVENTORY_RECEIVED` | `createPurchaseReceiptJournalEntry` |
| `stockAdjustmentAdapter` | `STOCK_ADJUSTMENT_POSTED` | `createInventoryWriteOffJournalEntry` |

## Dual COGS shutdown

Both POS bundled COGS and `/api/cogs/sale` call `postCostOfSalesAccounting` with
legacy source key `Sale-COGS` + `saleId`. Under `NEW_ENGINE`, legacy is skipped;
under `LEGACY`/`SHADOW`, `postGlEntry` idempotency on that key prevents a second
financial effect.

Invoice COGS uses `Invoice-COGS` + `invoiceId` through the same adapter.

## Legacy guard

`Sale` maps to `POINT_OF_SALE` / `INVENTORY_SOLD` (no longer `INVOICE_POSTED`).
Also gated: `Sale-COGS`, `Invoice-COGS`, `GoodsReceipt`,
`InventoryExpiryWriteOff`, `InventoryManualStockOut`.

Goods receipt legacy path adds `assertLegacyPostingAllowed` (previously bypassed
`postGlEntry`).

## Templates

ACTIVE v2 in `stageTemplates.js`: `CASH_SALE`, `COST_OF_SALES`,
`INVENTORY_PURCHASE`, `STOCK_ADJUSTMENT`.

## Follow-on

- Stage 3B: credit notes + refunds (kill refund Transaction bypass)
- POS cash-day deposit journal
- Supplier credit notes
- Stage 4: payroll
