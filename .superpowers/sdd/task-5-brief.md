### Task 5: Regression check — stock path still runs

**Files:**
- Verify only: `lib/applyGoodsReceiptInventoryPosting.js` (no change unless a bug is found)

**Interfaces:**
- Consumes: existing call to `autoCreateBillFromReceipt` after FIFO / inventory transactions
- Produces: confirmation stock + bill still coupled for non-deferred receipts

- [ ] **Step 1: Confirm call order is intact**

In `lib/applyGoodsReceiptInventoryPosting.js`, verify these still run in order inside one transaction:

1. `createFifoBatch(...)` per line (increments `Product.stockLevel`)
2. `inventoryTransaction.create` with `type: 'goods_receipt'`
3. `createPurchaseReceiptJournalEntry(...)`
4. set `inventoryAppliedAt`
5. `autoCreateBillFromReceipt(...)`

Do not reorder. Do not add payment creation.

- [ ] **Step 2: Re-run unit tests**

```bash
npx vitest run tests/unit/purchases/autoCreateBillFromReceipt.test.js
```

Expected: PASS.

- [ ] **Step 3: Done checklist vs spec success criteria**

- [ ] Stock increases on same-day receive
- [ ] Unpaid bill on Bills
- [ ] Bill selectable on Payments
- [ ] Works with GRNI on (unit test + manual if flag can be toggled)
- [ ] No payment auto-created
- [ ] Idempotent bill (unit test)

---

## Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| Stock ↑ on receive (existing path) | Task 5 verify + Task 4 manual |
| Always Unpaid auto-bill (incl. GRNI) | Tasks 1–2 |
| Balance increment on auto-bill | Tasks 1–2 |
| Idempotent one bill per receipt | Task 1 |
| No payment at receive | Tasks 2, 5 (explicit non-goal) |
| Future-date deferral unchanged | Task 4 warning notice only; no cron change |
| API bill ids for UI | Task 3 |
| UI toast/notice + links | Task 4 |
| Service receipts unchanged | Not modified |

## Placeholder scan

No TBD / “implement later” steps. Commit steps are explicit no-ops unless user asks.

