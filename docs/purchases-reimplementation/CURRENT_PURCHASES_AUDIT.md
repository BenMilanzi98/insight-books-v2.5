# Current Purchases Audit

**Date:** 2026-07-25  
**Scope:** Suppliers, Orders, Receipts, Bills, Payments (nav + APIs + Prisma + posting adapters)  
**Method:** Code inspection of routes, APIs, Prisma schema, V2 posting templates, inventory helpers. No assumption that pages working ≡ accounting correct.

---

## 1. What exists and works (operationally)

| Area | Evidence | Classification |
|------|----------|----------------|
| Nav menu | `Sidebar.js` → `/purchases/suppliers\|orders\|receipts\|bills\|payments` | `REUSE` |
| UI pages | `app/purchases/*/page.js` (+ supplier detail) | `EXTEND` / `REFACTOR` |
| CRUD APIs | `app/api/purchases/**` (16 route files) | `EXTEND` |
| Prisma aggregate chain | Supplier → PO → GR → Bill → Payment → Allocation | `EXTEND` |
| PO create → no stock / no journal | Order routes do not call posting/stock | `REUSE` (correct commitment behaviour) |
| GR stock via FIFO + inventory txn | `applyGoodsReceiptInventoryPosting.js` + `inventoryAppliedAt` gate | `EXTEND` (idempotency partial) |
| V2 cutover adapters | `goodsReceivedAdapter`, `supplierBillAdapter`, `supplierPaymentAdapter` | `REUSE` engine / `REIMPLEMENT` templates |
| Payment settlement pattern | Dr AP / Cr cash-bank (payment adapter) | `EXTEND` |
| Auto-bill from GR | `goodsReceiptFollowOn.autoCreateBillFromReceipt` links `journalEntryId`, skips second GL | `CONSOLIDATE` / risky policy |

---

## 2. Critical defects (accounting / inventory)

### C1 — Receipt credits AP, not GRNI (`INCORRECT_ACCOUNTING`)

- Template `INVENTORY_PURCHASE` (`stageTemplates.js`): Dr Inventory, Cr **Accounts Payable**.
- Comment text claims “GRNI / AP at receipt” but purpose resolved is `ACCOUNTS_PAYABLE`, not a GRNI control account.
- **Impact:** Liability recognised at receipt before supplier invoice; GRNI aging/reconciliation impossible; bill posting that also credits AP can double AP unless carefully skipped.

### C2 — Manual inventory bills can re-debit inventory (`DUPLICATE_POSTING_RISK`)

- Bill template: Dr Expense/Inventory/Asset + Dr VAT, Cr AP.
- Auto-bill path reuses GR journal and status `Unpaid` without re-posting (mitigation for that path only).
- Manual bill create/post path still capable of inventory debit after GR already increased stock and GL.

### C3 — No three-way matching (`INCOMPLETE` / `BLOCKED` for acceptance)

- No `matchingStatus` on bills/lines.
- No bill-line → goods-receipt-line FK.
- No tolerance engine, variance approval, or match UI.

### C4 — Weak document identity / idempotency (`UNSAFE`)

- No `idempotencyKey` on PO/GR/Bill/Payment.
- `Supplier.supplierCode` is **global** `@unique` (not tenant-scoped).
- `SupplierBill.billNumber` / `SupplierPayment.paymentNumber` global `@unique`.
- Bill number allocator for GR bills uses find-loop (`MAX`-like), not sequence service.

### C5 — Supplier returns / credit notes for AP (`NOT_APPLICABLE` / missing)

- AR `CreditNote` exists; no supplier return / supplier credit-note aggregate for P2P.

---

## 3. Medium / structural gaps

| Gap | Classification |
|-----|----------------|
| Coarse permissions (`purchases.view/create/update` only) vs prompt matrix | `INCOMPLETE` |
| Approval via status strings / dropdowns, not command workflow | `REIMPLEMENT` |
| No purchases dashboard separating Ordered / Received / Billed / Paid | `INCOMPLETE` |
| Suppliers hub oversized; orphaned patterns; thin detail tabs | `REFACTOR` |
| Export APIs exist; UI often disconnected | `DISCONNECTED` |
| Float money fields on Supplier/PO/Payment vs Decimal on bill lines | `DATA_INTEGRITY` |
| No branchId / warehouseId on PO/GR headers consistently | `INCOMPLETE` |
| Inspection / rejected / quarantine quantities not modelled | `INCOMPLETE` |
| Landed costs, WHT, FX PPV not first-class | `INCOMPLETE` |
| Virtually no automated purchase tests | `INCOMPLETE` |

---

## 4. Correct behaviours to preserve

1. **PO does not post stock or journals** — keep and lock with tests.  
2. **`inventoryAppliedAt` skip** — extend to line-level unique stock identity.  
3. **Canonical posting via Accounting V2 adapters** — do not create journals from React.  
4. **Payment reduces AP + cash**, does not re-expense (verify + harden idempotency).  
5. **Tenant filters** on most purchase API `findFirst`/`findMany` — extend + harden for IDOR.

---

## 5. Recommended disposition of current code

| Layer | Disposition |
|-------|-------------|
| Sidebar + page shells | `REUSE` structure, `REFACTOR` UX labels/metrics |
| `app/api/purchases/*` | `EXTEND` with commands, matching, idempotency |
| Prisma P2P models | `EXTEND` (fields/status/FKs); avoid parallel duplicate tables |
| `INVENTORY_PURCHASE` template | `REIMPLEMENT` → Dr Inventory / Cr GRNI |
| `SUPPLIER_BILL` template (inventory matched) | `REIMPLEMENT` → Dr GRNI (+ VAT/PPV) / Cr AP |
| Auto-bill-from-GR | `REFACTOR` — optional draft bill; never share liability journal incorrectly |
| Inventory posting helper | `EXTEND` — unique movement identity, reject/quarantine |
| Matching | **New** service + UI |
| Permissions | `EXTEND` default role templates + API checks |

---

## 6. Go / no-go for UI polish

**No-go.** Cosmetic UI work before GRNI + matching + duplicate-inventory closure would hard-code wrong financial semantics into dashboards (“AP at receipt” looks like billed payables).

**Progress since audit:** GRNI purpose `2115`, flag `purchasesGrniV2Enabled`, flag-gated receipt/bill templates, and auto-bill decoupling are implemented (default OFF). See `GRNI_ACCOUNTING_POLICY.md`.

**Next:** Schema EXTEND (match FKs, idempotency), PO no-post tests, pilot-enable GRNI, then three-way matching — before dashboard redesign.
