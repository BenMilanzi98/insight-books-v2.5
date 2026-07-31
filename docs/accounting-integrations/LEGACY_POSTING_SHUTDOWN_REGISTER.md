# Legacy Posting Shutdown Register

Goal: when `NEW_ENGINE` owns an event, no legacy writer may create a second
financial effect for the same source.

## Controls

1. **`assertLegacyPostingAllowed`** in `postGlEntry` (and explicit wrappers).
2. **`LEGACY_SOURCE_SCOPE`** maps legacy `sourceType` → module/event for mode
   lookup.
3. **Registry POSTED check** blocks legacy if V2 already posted the source.
4. **`assertNewEnginePostingAllowed`** inside the engine blocks V2 if a posted
   legacy journal already exists for the source.
5. **Cutover bridge** skips `legacyPost` entirely in `NEW_ENGINE`.

## Stage 1–2 sourceType coverage

| Legacy `sourceType` | V2 event | Shutdown ready |
| --- | --- | --- |
| Expense / ExpensePayment | EXPENSE_POSTED | Yes |
| BankCharge | BANK_CHARGE_POSTED | Yes |
| InterestIncome | INTEREST_INCOME_POSTED | Yes |
| Invoice / Sale | INVOICE_POSTED | Yes |
| Payment | CUSTOMER_PAYMENT_POSTED | Yes |
| SupplierBill | SUPPLIER_BILL_POSTED | Yes |
| SupplierPayment | SUPPLIER_PAYMENT_POSTED | Yes |
| Sale | INVENTORY_SOLD | Yes (Stage 3A) |
| Sale-COGS / Invoice-COGS | COST_OF_SALES_RECOGNIZED | Yes (Stage 3A) |
| GoodsReceipt | INVENTORY_RECEIVED | Yes (Stage 3A; JE path guarded) |
| InventoryExpiryWriteOff / InventoryManualStockOut | STOCK_ADJUSTMENT_POSTED | Yes (Stage 3A) |
| CreditNote | CUSTOMER_CREDIT_NOTE_POSTED | Yes (Stage 3B) |
| InvoiceRefund | CUSTOMER_REFUND_POSTED | Yes (Stage 3B; bypass killed) |

## Remaining (scaffold / later stages)

Payroll, Asset, Liability*, equity capital_contribution, POS cash deposit,
Transfer, imports/webhooks — scoped where known; adapters scaffolded. Do not
flip those modules to `NEW_ENGINE` until Stage N wiring lands.

## Bypass inventory (must stay guarded)

| Writer | Guard |
| --- | --- |
| `lib/accountingEngine/postGlEntry.js` | `assertLegacyPostingAllowed` |
| Stage 1–2 cutover `legacyPost` closures | Call guard before legacy body where not already via `postGlEntry` |
| Direct `journalService` / ad-hoc creates | Track in follow-on; prefer routing through cutover |

## Cutover evidence checklist (per module)

- [ ] SHADOW run: no dual authority (legacy authoritative; V2 observe-only)
- [ ] NEW_ENGINE: legacy path throws `LegacyAndNewPostingConflictError`
- [ ] Replay / idempotency: second submit does not double-post
- [ ] Operational `journalEntryId` / UI source state correct
