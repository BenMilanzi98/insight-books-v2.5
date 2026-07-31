# Inventory Posting Audit

## Authoritative path today

Posted goods receipt → `applyGoodsReceiptInventoryPosting`:

1. FIFO batch(es) via `createFifoBatch` (`sourceType: 'GoodsReceipt'`)
2. `inventoryTransaction` row (`type: 'goods_receipt'`)
3. GL journal (separate concern)
4. `inventoryAppliedAt` timestamp

## What must never increase stock (verify)

| Event | Expected | Current assessment |
|-------|----------|-------------------|
| PO create/approve/send | No stock | Appears correct |
| Bill create/post | No stock | **Risk** if bill handlers also create FIFO/inventory txn — must audit bill route |
| Payment | No stock | Appears correct |

## Idempotency

| Mechanism | Scope | Gap |
|-----------|-------|-----|
| `inventoryAppliedAt` | Whole receipt | Concurrent double-apply race possible without row lock |
| FIFO `sourceId` | Often `goodsReceipt.id` only | Line/allocation collisions if multi-line shares same sourceId |
| DB unique on movement | Missing | `DUPLICATE_POSTING_RISK` |

## Inspection / rejected qty

Not modelled — all `quantityReceived` goes to FIFO/available. Classification: `INCORRECT_INVENTORY` if rejected goods entered as received.

## Services / assets

- GR item requires `productId` — service receipts without products unsupported.
- Asset PO follow-on creates Asset drafts — separate from inventory; ensure no double fixed-asset capitalisation at bill.

## Target

Immutable stock movement identity:

`tenantId + businessId + goodsReceiptLineId + receiptVersion + PURCHASE_RECEIPT_STOCK`
