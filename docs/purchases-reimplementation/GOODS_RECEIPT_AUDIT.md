# Goods Receipt Audit

## Classification: `EXTEND` (stock path) / `INCORRECT_ACCOUNTING` (GL) / `INCOMPLETE` (inspection)

### Stock path (partially correct)

`lib/applyGoodsReceiptInventoryPosting.js`:

1. Skip if `inventoryAppliedAt` set → **header-level idempotency** (`EXTEND` needed to line uniqueness).
2. Creates FIFO batches (`sourceType: 'GoodsReceipt'`).
3. Creates `inventoryTransaction` type `goods_receipt`.
4. Posts GL via `createPurchaseReceiptJournalEntry` → V2 adapter.
5. Auto-creates supplier bill.
6. Asset sync for asset POs.

**Stock increases on posted receipt** — aligns with rule “stock on receipt”.  
**Gaps:** no accepted vs rejected qty; product required on every line (services awkward); no warehouse on header/line; serial uniqueness not enforced; no immutable stock-movement identity table link.

### GL path (incorrect vs GRNI policy)

Posts **Dr Inventory / Cr AP** via template `INVENTORY_PURCHASE`.  
Not: Dr Inventory / Cr GRNI.

### Partial receipts

Multiple GRs against one PO supported if qtyReceived accumulates — **operationally yes**, but over-receipt policy / approval missing.

### Reversal

No first-class receipt reverse command creating opposite stock + linked reversing journal. Classification: `INCOMPLETE`.

### Auto-bill coupling

Receipt posting creates Unpaid bill and increments `supplier.currentBalance` while liability already in AP from receipt journal — **semantic confusion** between bill document and AP recognition. Classification: `REFACTOR` / `DUPLICATE_POSTING_RISK` if manual bill also posts.
