# Current Product/Service/Inventory Audit

| Area | Finding | Class |
|---|---|---|
| Local Product | sku, barcode, taxRate, isService, stockLevel | REUSE |
| Local Service | Product.isService=true | REUSE |
| ProductVariant | No model | NOT_APPLICABLE |
| Warehouse | InventoryLocation + site mapping warehouseId | EXTEND |
| Stock | InventoryTransaction | REUSE (read-only for reconcile) |
| External catalogue | MraEisExternalCatalogueItem | REUSE/EXTEND |
| Product mapping | MraEisProductMapping | EXTEND |
| Sync Run | MraEisSyncRun | EXTEND |
| UOM | Unit / ProductUnit | REUSE |
| Phase 9 resolution | Site/Tax/Levy/Payment | REUSE |

---
*Phase 10 implementation. External catalogue ≠ local master data. Suggestions never auto-activate. No Sale/fiscal number/QR. No Journal/Stock/price/tax auto-mutation. Product sync method Q-003 blocked for production. Initial Inventory upload blocked until verified. Cross-type mappings blocked by default.*
