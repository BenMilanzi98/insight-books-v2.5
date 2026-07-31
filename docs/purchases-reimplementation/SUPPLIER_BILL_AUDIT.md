# Supplier Bill Audit

## Classification: `EXTEND` / `DUPLICATE_POSTING_RISK` / `INCOMPLETE` (matching)

### Document model

- Links: optional `purchaseOrderId`, `goodsReceiptId` (header only — not line-level).
- `billType` default `inventory`.
- Money: Decimal on header/lines (better than PO Floats).
- `journalEntryId` may point at **receipt** journal for auto-bills (shared identity).

### Auto-bill from GR (`goodsReceiptFollowOn.js`)

- One bill per `goodsReceiptId` (findFirst guard).
- Status `Unpaid`, `finalizedAt` set, **reuses GR journalEntryId**.
- Increments supplier `currentBalance`.
- Does **not** call `postSupplierBillAccounting` again — avoids second journal **on that path**.

### Manual / posted bills

V2 `SUPPLIER_BILL` template: Dr expense/inventory/asset (+ VAT), Cr AP.  
If inventory already capitalised at GR and AP already credited at GR, a second bill post **double-counts** unless guarded.

### Duplicate supplier invoice

`supplierInvoiceNumber` stored; **no unique constraint** / detector. Classification: `INCOMPLETE` / `UNSAFE`.

### Three-way match

Absent — see `THREE_WAY_MATCHING_AUDIT.md`.

### Required reimplementation

1. Bill posts AP recognition + GRNI clear for matched inventory (not second inventory receipt).  
2. Line FKs to PO line + GR line.  
3. Matching status + tolerances.  
4. Idempotent bill posting key.  
5. Tenant-scoped bill numbers + supplier-invoice uniqueness.
