# Accounting Posting Audit

## Authority path (current)

```
UI/API → applyGoodsReceiptInventoryPosting / bill&payment routes
       → lib/purchaseAccounting.js wrappers
       → accountingV2 adapters (goodsReceived / supplierBill / supplierPayment)
       → Posting Engine cutover (submitViaCutover)
       → Templates (stageTemplates / definitions)
```

Legacy direct journal create in `purchaseAccounting.js` after cutover is **dead code** (`LEGACY_POSTING_REMOVED`) — `LEGACY_READ_ONLY` / delete later.

## Event matrix (as implemented)

| Event | Template | Debit | Credit | Verdict |
|-------|----------|-------|--------|---------|
| PO create/approve | — | — | — | **Correct** (no post) |
| Goods receipt | `INVENTORY_PURCHASE` | Inventory | **AP** | **`INCORRECT_ACCOUNTING`** vs GRNI policy |
| Auto bill from GR | none (reuse JE) | — | — | Document-only; AP already from GR |
| Manual supplier bill | `SUPPLIER_BILL` | Exp/Inv/Asset + VAT | AP | **Risk** if GR already posted AP+Inv |
| Supplier payment | payment template | AP | Cash/Bank | **Correct direction** |

Template evidence (`stageTemplates.js`):

- Inventory receipt description: *"Dr Inventory, Cr Accounts Payable (GRNI / AP at receipt)."* — naming contradiction; purpose `ACCOUNTS_PAYABLE`.
- Bill description: *"Dr Expense/Inventory/Asset, Dr VAT Input, Cr Accounts Payable."* — no GRNI clear.

## GRNI control account

No dedicated GRNI purpose / CoA mapping verified in purchases posting path. Classification: **`BLOCKED`** until CoA purpose `GRNI` / Accrued Purchases added and templates switched.

## Period / balance rules

- Engine path validates period via cutover stack (verify per tenant).
- Direct balance edits must remain forbidden — purchases must not call `updateAccountBalance` outside engine.

## Target matrix

See `PURCHASES_ACCOUNTING_POSTING_MATRIX.md`.
