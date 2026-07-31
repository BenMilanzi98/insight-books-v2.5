# Multi-Tenant Risk Register

| ID | Risk | Severity | Notes |
|----|------|----------|-------|
| MTR-01 | Global `supplierCode` unique | Medium | Blocks independent tenant namespaces |
| MTR-02 | Global `billNumber` / `paymentNumber` | Medium | Collision / information leak via uniqueness errors |
| MTR-03 | IDOR if API omits tenantId on update | High | Must reload by `{ id, tenantId }` every command |
| MTR-04 | Warehouse/product from other tenant on receipt | Critical if unchecked | Validate ownership on every GR line |
| MTR-05 | Export/attachment signed URLs | High | Must re-check tenant + permission at download |
| MTR-06 | Cache keys without tenant | Medium | Audit list caches |
| MTR-07 | Search without tenant filter | Critical if present | Spot-check all list endpoints |

## Current mitigations

- Most purchase APIs use session tenant + `where: { tenantId }` — **REUSE** pattern.
- Page/API access maps exist in `tenantPageAccess` / `tenantApiAccess`.

## Business / branch

- Explicit `businessId` not on P2P models (tenant-centric app today).
- Branch on GR posting via `resolveBranchId` for inventory — not consistently stored on documents.

Classification: **`EXTEND`** isolation; treat missing product/warehouse checks as **`CROSS_TENANT_RISK`** until proven in tests.
