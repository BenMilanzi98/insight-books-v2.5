# Purchases Module Reimplementation

Forensic audit and redesign of InsightBooks V2 procure-to-pay:

**Supplier → Purchase Order → Goods Receipt → Supplier Bill → Supplier Payment**

## Status (2026-07-25)

| Phase | Status |
|-------|--------|
| Forensic audit (§3) | Complete — see docs below |
| Gap register & plan | Complete |
| Data model / state machines | Not started |
| True GRNI posting | **Default ON** — receipt Cr GRNI; bill clears GRNI; bills never add stock |
| Three-way matching | **Service + API** (`lib/purchases/threeWayMatching.js`, `/api/purchases/bills/match`) |
| UI reimplementation | Next — wire match preview + correct commitment labels |
| Automated test matrix | GRNI + matching + PO commitment tests passing (9) |

## Source-of-truth rules (enforced by this programme)

1. Chart of Accounts → Posting Engine → Journals → GL → reports  
2. Stock Movements are the only inventory quantity evidence  
3. Purchase Orders are commitments only (no journal, no stock)  
4. Stock increases only on posted accepted Goods Receipts  
5. Bills recognise AP (and clear GRNI); they must not re-receive stock  
6. Payments settle AP; they must not re-recognise purchases  

## Document index (audit pack)

| Document | Purpose |
|----------|---------|
| [CURRENT_PURCHASES_AUDIT.md](./CURRENT_PURCHASES_AUDIT.md) | Executive audit summary |
| [ROUTE_AND_COMPONENT_INVENTORY.md](./ROUTE_AND_COMPONENT_INVENTORY.md) | Routes, pages, components |
| [DATABASE_MODEL_AUDIT.md](./DATABASE_MODEL_AUDIT.md) | Prisma models vs target |
| [SUPPLIER_DATA_AUDIT.md](./SUPPLIER_DATA_AUDIT.md) | Supplier master |
| [PURCHASE_ORDER_AUDIT.md](./PURCHASE_ORDER_AUDIT.md) | PO workflow |
| [GOODS_RECEIPT_AUDIT.md](./GOODS_RECEIPT_AUDIT.md) | Receipts |
| [SUPPLIER_BILL_AUDIT.md](./SUPPLIER_BILL_AUDIT.md) | Bills |
| [SUPPLIER_PAYMENT_AUDIT.md](./SUPPLIER_PAYMENT_AUDIT.md) | Payments |
| [ACCOUNTING_POSTING_AUDIT.md](./ACCOUNTING_POSTING_AUDIT.md) | GL posting path |
| [INVENTORY_POSTING_AUDIT.md](./INVENTORY_POSTING_AUDIT.md) | Stock path |
| [THREE_WAY_MATCHING_AUDIT.md](./THREE_WAY_MATCHING_AUDIT.md) | Matching gaps |
| [DUPLICATE_POSTING_RISK_REGISTER.md](./DUPLICATE_POSTING_RISK_REGISTER.md) | Duplicate risks |
| [DATA_INTEGRITY_RISK_REGISTER.md](./DATA_INTEGRITY_RISK_REGISTER.md) | Integrity risks |
| [MULTI_TENANT_RISK_REGISTER.md](./MULTI_TENANT_RISK_REGISTER.md) | Tenant isolation |
| [PERMISSION_AUDIT.md](./PERMISSION_AUDIT.md) | Permissions / SoD |
| [REPORT_AUDIT.md](./REPORT_AUDIT.md) | Reports |
| [TEST_COVERAGE_AUDIT.md](./TEST_COVERAGE_AUDIT.md) | Tests |
| [FINAL_GAP_REGISTER.md](./FINAL_GAP_REGISTER.md) | Prioritised gaps |
| [REIMPLEMENTATION_PLAN.md](./REIMPLEMENTATION_PLAN.md) | Ordered delivery plan |
| [PURCHASES_ACCOUNTING_POSTING_MATRIX.md](./PURCHASES_ACCOUNTING_POSTING_MATRIX.md) | Target posting matrix |
| [IMPLEMENTATION_TASKS.md](./IMPLEMENTATION_TASKS.md) | Executable task list |

## Classification legend

`REUSE` · `EXTEND` · `REFACTOR` · `REIMPLEMENT` · `CONSOLIDATE` · `LEGACY_READ_ONLY` · `DUPLICATED` · `INCORRECT_ACCOUNTING` · `INCORRECT_INVENTORY` · `DUPLICATE_POSTING_RISK` · `CROSS_TENANT_RISK` · `DISCONNECTED` · `INCOMPLETE` · `UNSAFE` · `BLOCKED` · `NOT_APPLICABLE`

## Critical finding (do not ignore)

Goods Receipt posting currently uses **Dr Inventory / Cr Accounts Payable**, described in templates as “GRNI / AP at receipt”. That is **not** true GRNI clearing. Auto-bills from receipts reuse the receipt journal; **manual inventory bills can still debit inventory again** → duplicate stock/value risk.
