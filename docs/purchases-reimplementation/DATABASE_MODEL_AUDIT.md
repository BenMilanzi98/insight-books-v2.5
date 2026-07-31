# Database Model Audit

**Source:** `prisma/schema.prisma` models `Supplier` … `SupplierPaymentAllocation` (~lines 1285–1566).

## Aggregate chain (exists)

```
Supplier
  ├── PurchaseOrder → PurchaseOrderItem
  │     └── GoodsReceipt → GoodsReceiptItem
  │           └── SupplierBill → SupplierBillItem
  └── SupplierPayment → SupplierPaymentAllocation → SupplierBill
```

Classification: **`EXTEND`** — do not create parallel `PurchaseOrderV2` tables; evolve these models.

---

## Model-by-model

### Supplier — `EXTEND` / `INCOMPLETE`

| Present | Missing vs prompt |
|---------|-------------------|
| code, name, contact, address, taxId, terms, currency, creditLimit, balance, bank fields, isActive | trading name, type, VAT#, registration#, risk, preferred, multi-contact, multi-bank, compliance docs, WHT defaults, default AP/expense/warehouse, merge/audit fields |
| `supplierCode @unique` **global** | Must be **tenant-scoped** unique |

### PurchaseOrder — `EXTEND`

| Present | Missing |
|---------|---------|
| poNumber (tenant unique), supplier, dates, amounts (Float), status string, orderType, tax flags | branchId, warehouseId, project/dept/cost centre, qty rollups, receipt/billing/payment status dims, version, idempotency, amendment/revision |
| Status free string | Formal state machine + derived statuses |

### PurchaseOrderItem — `EXTEND`

| Present | Missing |
|---------|---------|
| lineType, product, productUnit, expenseCategory, qty ordered/received, cost, tax | accepted/rejected/returned/billed qty, warehouse, serviceId, lineStatus, UOM conversion explicit base qty |

### GoodsReceipt — `EXTEND` / `INCORRECT_ACCOUNTING` linkage

| Present | Missing |
|---------|---------|
| receiptNumber (tenant unique), PO optional, journalEntryId, inventoryAppliedAt, status | warehouseId, inspectionStatus, postingStatus, rejected totals, stockMovementBatchId, idempotencyKey, branchId |

### GoodsReceiptItem — `EXTEND` / `INCOMPLETE`

| Present | Missing |
|---------|---------|
| product **required**, PO item link, qty, cost, batch, expiry, expiryAllocations JSON | accepted/rejected/damaged, serials, warehouse/bin, stockMovementId, service lines (product required blocks pure services), qualityStatus |

### SupplierBill — `EXTEND` / `DUPLICATE_POSTING_RISK`

| Present | Missing |
|---------|---------|
| billNumber **global unique**, PO/GR links, billType, supplierInvoiceNumber, decimals for money, journalEntryId, finalized* | matchingStatus, postingStatus, approvalStatus, outstanding derived, accountingPeriodId, idempotencyKey, sourceChecksum, tenant-scoped bill number |
| Duplicate supplier invoice | No unique on (tenantId, supplierId, supplierInvoiceNumber) |

### SupplierBillItem — `EXTEND` / `INCOMPLETE`

| Present | Missing |
|---------|---------|
| product?, expenseAccountId?, qty, cost, tax | purchaseOrderItemId, goodsReceiptLineId, assetAccountId, lineType, withholding |

### SupplierPayment — `EXTEND`

| Present | Missing |
|---------|---------|
| paymentNumber **global unique**, method, bankAccountId, journal, reversal fields | approval/posting status, allocated/unallocated, idempotencyKey, paymentAccountId (CoA), WHT |

### SupplierPaymentAllocation — `EXTEND`

| Present | Gap |
|---------|-----|
| payment↔bill amount | No unique (paymentId, billId); discount/WHT/FX columns missing |

---

## Constraints summary

| Constraint | Status | Risk |
|------------|--------|------|
| `@@unique([tenantId, poNumber])` | OK | — |
| `@@unique([tenantId, receiptNumber])` | OK | — |
| `supplierCode @unique` global | **Wrong scope** | `CROSS_TENANT_RISK` / collision |
| `billNumber @unique` global | Fragile | Collision across tenants |
| `paymentNumber @unique` global | Fragile | Collision |
| GR line → unique PURCHASE_RECEIPT movement | **Missing** | `DUPLICATE_POSTING_RISK` |
| Bill posting idempotency key | **Missing** (engine may help via sourceId) | Partial |
| Supplier invoice duplicate | **Missing** | Data integrity |
| Decimal money everywhere | Mixed Float/Decimal | Rounding drift |

---

## Absent models (prompt)

Purchase Requisition, RFQ, Supplier Quotation, Supplier Return, Supplier Credit Note, Landed Cost allocation, Match Result, Approval Task (purchases-specific), Document Sequence (purchases).

Classification: **`NOT_APPLICABLE` today → implement as needed** (returns/credits/matching first; requisition/RFQ later if product scope requires).
