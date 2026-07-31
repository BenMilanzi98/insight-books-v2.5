# Product and Service Model Audit

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

- Primary stock entity: `Product` with stockLevel; services often products with flags or separate handling.
- Units: flexible unit conversion on sales.
- Tax assignment: item tax types / SaleItemTax.
- MRA mapping: productCode / UNSPSC via EIS utilities — **not versioned local mapping table**.
- Bundles/composites: risk if opaque lines — GAP for MRA line expansion.

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
