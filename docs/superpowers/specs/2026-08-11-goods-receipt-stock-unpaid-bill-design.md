# Design: Goods Receipt → Instant Stock + Unpaid Supplier Bill

**Date:** 2026-08-11  
**Status:** Approved (approach A)  
**Pages:** `/purchases/receipts`, `/purchases/bills`, `/purchases/payments`

## Problem

When inventory goods are received via the **Receive Goods** modal on `/purchases/receipts`, stock must increase immediately, and the receipt amount must appear as an **Unpaid** supplier bill on `/purchases/bills` that can be selected and paid on `/purchases/payments` (no payment recorded at receive time).

Today, stock posting and auto-bill creation already exist in the receive path, but when GRNI is enabled the auto-bill is created as **Draft**, so it does not appear on the payments unpaid-bill picker.

## Decisions (approved)

1. **Payment behavior:** Create an **Unpaid** bill only — do not record a payment at receive time.
2. **GRNI:** Always create **Unpaid** on receive, even when GRNI is on.
3. **Approach A:** Harden the existing receive posting path (`applyGoodsReceiptInventoryPosting` + `autoCreateBillFromReceipt`), rather than async jobs or Draft-then-finalize.

## Goal

For a **posted inventory** goods receipt with a non-future receipt date, in the same DB transaction:

1. Increase stock (FIFO batch + `Product.stockLevel` + `InventoryTransaction`).
2. Create exactly one **Unpaid** `SupplierBill` linked to the receipt.
3. Make that bill visible on Bills and selectable on Payments.

## Non-goals

- Auto-creating `SupplierPayment` records
- Changing future-dated receipt deferral (cron still applies later)
- Changing service-receipt / service-PO bill flows
- Reworking GRNI accounting for manual bill finalize elsewhere
- Broad payments UI redesign beyond relying on `status=Unpaid`

## Current architecture (relevant)

| Piece | Role |
|-------|------|
| `POST /api/purchases/receipts` | Creates `GoodsReceipt`; calls inventory posting when posted & not deferred |
| `lib/applyGoodsReceiptInventoryPosting.js` | FIFO + stock + GL + `autoCreateBillFromReceipt` |
| `lib/goodsReceiptFollowOn.js` → `autoCreateBillFromReceipt` | Creates `SupplierBill` (`GRB-{receiptNumber}`) |
| `lib/purchases/grniPolicy.js` | Today drives Draft vs Unpaid on auto-bill |
| `/purchases/payments` | Loads `/api/purchases/bills?status=Unpaid` |

## Design

### Backend

**Primary change:** `autoCreateBillFromReceipt` in `lib/goodsReceiptFollowOn.js`

- Always set `status: 'Unpaid'` (ignore `isPurchasesGrniEnabled` for this auto-bill path).
- Always attach receipt journal when available (`journalEntryId` from posting).
- Always set `finalizedAt` / `finalizedById` as today for Unpaid bills.
- Always increment `supplier.currentBalance` by the bill total.
- Keep idempotency: if a bill already exists for `goodsReceiptId` + `tenantId`, return it.
- Keep bill number pattern `GRB-{receiptNumber}` with uniqueness suffix.
- Keep line items from receipt qty × unit cost; `amountPaid: 0`.

**Unchanged:** `applyGoodsReceiptInventoryPosting` stock/FIFO/`inventoryAppliedAt`/GL orchestration, except ensuring bill creation still runs after stock for every successful inventory apply.

**API response (optional but recommended):** Include created bill identifiers when posting succeeds, e.g. `supplierBillId`, `billNumber`, so the UI can deep-link.

### Edge cases

| Case | Behavior |
|------|----------|
| Posted inventory, receipt date ≤ today (UTC) | Stock + Unpaid bill immediately |
| Future receipt date | Defer stock/GL/bill until cron (`apply-deferred-goods-receipts`) — unchanged |
| Service receipts | No inventory; existing service bill path unchanged |
| Already applied (`inventoryAppliedAt` set) | Skip stock; bill create remains idempotent |
| Zero / rejected accepted qty lines | Do not increase stock for those lines |
| Duplicate receive retry | No second bill |

### UI

On successful Receive Goods (inventory):

- Toast confirming stock updated and unpaid bill created.
- Links to `/purchases/bills` and `/purchases/payments` (and bill detail if id returned).

No change to the payments form beyond bills appearing as Unpaid.

### Accounting note

Forcing Unpaid when GRNI is on means supplier AP / balance is recognized at **goods receipt**, not deferred until supplier-invoice match/finalize. This is intentional per product decision. Manual GRNI finalize flows for other bill creation paths are out of scope.

## Success criteria

1. Receive Goods for a product with qty N increases that product’s stock by N immediately (same-day receipt).
2. A matching Unpaid bill appears on `/purchases/bills` with total = Σ(qty × unitCost).
3. That bill appears in `/purchases/payments` unpaid bill list and can be paid there.
4. Behavior holds whether GRNI tenant flag is on or off.
5. No payment is created at receive time.
6. Re-posting / retry does not double stock or create a second bill.

## Implementation touchpoints

1. `lib/goodsReceiptFollowOn.js` — Unpaid-always for auto bill from receipt
2. `app/api/purchases/receipts/route.js` — optional response fields for bill
3. `app/purchases/receipts/page.js` — success toast + links
4. Tests covering `autoCreateBillFromReceipt` (Unpaid + balance + idempotency) and/or receipt POST integration if present

## Spec self-review

- No TBD placeholders for core behavior.
- Decisions match brainstorming (option 1 payments, always Unpaid under GRNI, approach A).
- Scope excludes payments auto-create and future-date policy changes.
- Consistent with existing model names: `GoodsReceipt`, `SupplierBill`, `SupplierPayment`.
