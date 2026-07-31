# Stock Management — Reimplementation Workspace

| Field | Value |
|---|---|
| Started | 2026-07-22 |
| Status | **Hybrid design approved — Slice 1 in progress (4-col import/export live)** |
| Current UI | `/stock` + `/stock/import` + `/stock/export` |
| Costing | **Hybrid:** FIFO batches + WAC Order Price |
| Location | **Business = hidden primary branch** (no user branch setup) |

## Required reading order

1. [CURRENT_STOCK_IMPLEMENTATION.md](./CURRENT_STOCK_IMPLEMENTATION.md)
2. [STOCK_MODULE_GAP_REGISTER.md](./STOCK_MODULE_GAP_REGISTER.md)
3. [STOCK_DATA_INTEGRITY_REPORT.md](./STOCK_DATA_INTEGRITY_REPORT.md)
4. [STOCK_REIMPLEMENTATION_TASKS.md](./STOCK_REIMPLEMENTATION_TASKS.md)

## Hard gates (do not skip)

- No broad reimplementation until the four docs above exist (**done**).
- No schema/migrations until design forks are approved (see design note in gap register).
- Preserve valid existing stock data; reconstruct missing movements as `MIGRATION_OPENING` / `LEGACY_RECONSTRUCTION` only.
- Financial stock events must use Accounting V2 Posting Engine (`executePosting`), never bare `postGlEntry`.

## Related existing docs

- `docs/accounting-repair/INVENTORY_RECONCILIATION.md`
- Phase 9 adapters: `lib/accountingV2/adapters/{stockAdjustment,goodsReceived,costOfSales}Adapter.js`
