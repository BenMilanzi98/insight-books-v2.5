# Future EIS Snapshot Input Contract

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

| Field | Current source | Stability | Gap |
|---|---|---|---|
| tenant/businessId | session tenantId | Stable | — |
| branchId | Sale.branchId | Optional | site mapping |
| localSaleId | Sale.id / Invoice.id | Stable | — |
| version | Missing | — | Add |
| local number | saleNumber / invoiceNumber | Stable | ≠ fiscal number |
| datetime | sale/invoice date | Clock skew | TZ policy |
| seller TIN | Tenant.tpin | Stable | Validate |
| buyer TIN/name | Partial | Editable later | Freeze in snapshot |
| lines | SaleItem / invoice lines | | productCode map |
| tax/levy | SaleItemTax / calculations | Float | Decimal + MRA rateId |
| payment | paymentMethod / allocations | Free string | MRA enum map |
| journal ref | V2 source link | | Required |
| amount tendered | Partial | | |

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
