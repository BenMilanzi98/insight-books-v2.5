# Phase 9 — Phases 1–8 Evidence Index

Operational-module cutover evidence. Findings are taken from prior-phase
artifacts and a 2026-07-21 repository re-sweep; nothing below is invented.

| ID | Phase | Finding / decision | Module(s) | Required Phase 9 control | Evidence |
| --- | --- | --- | --- | --- | --- |
| E1 | 1 | ~30 engine-routed + 11 engine-bypass write paths; dual T+J writers; balance-only paths | All | Adapter + legacy shutdown per path | `docs/accounting-audit/ACCOUNTING_POSTING_MATRIX.md`, `DUPLICATE_POSTING_ANALYSIS.md` |
| E2 | 1 | Invoice draft→issued checks `JournalEntry` while engine writes `Transaction` → double-post window | Invoices | Idempotency via `AcctV2EventRegistry` only | ACCOUNTING_POSTING_MATRIX |
| E3 | 1 | Payment GL failures swallowed → payment without journal | Payments | Visible `POSTING_FAILED` + exception | ACCOUNTING_POSTING_MATRIX |
| E4 | 1 | Expense partial payment re-debits expense instead of clearing AP | Expenses | Correct payment template (Dr AP / Cr cash) | ACCOUNTING_POSTING_MATRIX |
| E5 | 1 | Goods receipt posts JE only (no balances); bill finalize may double inventory | Purchases | Single recognition policy (GRNI vs bill) + engine | ACCOUNTING_POSTING_MATRIX |
| E6 | 1 | Supplier payment dual T+J, no balance update; unbalanced tax line | Payables | Engine-only payment; kill dual write | ACCOUNTING_POSTING_MATRIX |
| E7 | 1 | Payroll enhanced + process-expense can double-post salary | Payroll | One payroll event; separate payment event | ACCOUNTING_POSTING_MATRIX |
| E8 | 1 | Asset create bypasses engine; depreciation has no GL | Fixed assets | ASSET_ACQUIRED + DEPRECIATION_POSTED templates | ACCOUNTING_POSTING_MATRIX |
| E9 | 1 | Liability payment: JE + empty Transaction + AB decrement | Loans | LOAN_REPAYMENT via engine only | ACCOUNTING_POSTING_MATRIX |
| E10 | 1 | Capital contribution weak idempotency; settings counter parallel | Equity | CAPITAL_CONTRIBUTION event + registry | ACCOUNTING_POSTING_MATRIX |
| E11 | 1 | POS cash deposit mutates balances with no journal | Banking/POS | BANK_TRANSFER / cash deposit event | ACCOUNTING_POSTING_MATRIX |
| E12 | 1 | COGS dual callers (POS path + `/api/cogs/sale`) | Inventory/POS | Single COST_OF_SALES_RECOGNIZED event | ACCOUNTING_POSTING_MATRIX |
| E13 | 2 | Target: Accounting Context, Event Registry, idempotency, feature flags, LEGACY/SHADOW/NEW_ENGINE | All | Reuse; do not invent parallel modes | `docs/accounting-architecture/`, FINAL_PHASE_2_REPORT |
| E14 | 2 | Cutover strategy: module-by-module, business-by-business | All | MODULE_CUTOVER_FRAMEWORK | FEATURE_FLAG_STRATEGY, ACCOUNTING_CUTOVER_STRATEGY |
| E15 | 3 | Account Mapping Service + system/control accounts; Account 5200 salaries; Expense hierarchy | All | Adapters resolve via mapping service only — no name/ID hardcoding | SYSTEM_ACCOUNT_REGISTRY, ACCOUNT_MAPPING_REGISTRY |
| E16 | 4 | `executePosting` / preview / retry; templates ACTIVE for pilots; DEFINED for ops | All | Activate DEFINED templates with `buildDraft` | FINAL_PHASE_4_REPORT, POSTING_TEMPLATE_CATALOGUE |
| E17 | 4 | Source posting state via `AcctV2EventRegistry` (not per-table columns) | All | Use `getSourcePostingState`; optional UI denormalized cache only | SOURCE_POSTING_STATUS.md |
| E18 | 4 | `assertLegacyPostingAllowed` on `postGlEntry` / journalService — direct writers bypass | All | Extend guard OR eliminate direct writers | LEGACY_POSTING_GUARD.md |
| E19 | 4 | CUSTOMER_INVOICE template ACTIVE as shadow pilot only | Invoices | Wire route + promote to NEW_ENGINE after shadow | pilotTemplates.js |
| E20 | 5 | Canonical JE + GL Query; reports from posted lines | All | No source totals as report truth | FINAL_PHASE_5_REPORT |
| E21 | 6 | Historical exceptions / repair framework for remaining defects | All | Failed postings → exception register; no silent rewrite | FINAL_PHASE_6_REPORT |
| E22 | 7 | TB / statements / snapshots / dashboard from GL | All | Module reconciliations feed close checks | FINAL_PHASE_7_REPORT |
| E23 | 8 | Period Resolution V2, closed-period, backdating, readiness | All | Every adapter uses posting dates; no client period IDs | PHASE_9_READINESS.md, PERIOD_RESOLUTION_SERVICE.md |
| E24 | 8 | Operational modules still on legacy; only manuals/OBs/reversals/repair on V2 | All | This phase | PHASE_9_READINESS.md |
| E25 | 2026-07-21 re-sweep | No operational module calls `executePosting`; no payment webhooks posting GL; cron: deferred GR + POS cash | All | CURRENT_OPERATIONAL_ACCOUNTING_PATHS.md | Repo inventory |

## Module summary (Phase 9 status at start)

| Module | Legacy paths | Mappings | Duplicate risk | Target events | Blockers |
| --- | --- | --- | --- | --- | --- |
| Customer invoices | createInvoiceJournalEntry + tax | AR + revenue | Wrong-table idempotency | INVOICE_POSTED | Route wiring; shadow exit |
| Customer payments | createInvoicePaymentJournalEntry | Cash + AR | Unstable payment key; swallowed errors | CUSTOMER_PAYMENT_POSTED | Idempotency key; failure visibility |
| Credit/refund | credit note helper; refund direct Tx | Returns + AR/cash | Engine bypass on refund | CREDIT_NOTE / REFUND | Kill direct Tx |
| POS/Sales | createSaleJournalEntries + COGS + tax | Cash + revenue + inventory | Dual COGS; gross+tax | POS_SALE + COST_OF_SALES | Single event identity |
| Supplier bills | finalizeExpense/InventoryBill | AP + expense/inv | GR(J)+bill(T) double | SUPPLIER_BILL_POSTED | GRNI policy |
| Supplier payments | createSupplierPaymentEntry dual | AP + bank | Dual ledger; unbalanced tax | SUPPLIER_PAYMENT_POSTED | Kill dual write |
| Expenses | createExpenseJournalEntry | Expense leaf + cash/AP | Partial-pay double expense | EXPENSE_POSTED + payment | Fix payment template |
| Payroll | enhanced postGlEntry + process expense | 5200 + liabilities | Double salary | PAYROLL_POSTED + PAYROLL_PAYMENT | One workflow |
| Inventory | write-off + GR JE + COGS APIs | Inventory + COS | Dual COGS | INVENTORY_* events | Unify |
| Banking/POS cash | transfer/adj via engine; POS AB only | Bank/cash | No journal on deposit | BANK_* events | Journal POS cash |
| Fixed assets | direct Tx; dep schedule only | Asset + accum dep | No dep GL | ASSET_* | Templates |
| Loans | opening engine; payment bypass | Liability + interest | Empty Tx + AB | LOAN_* | Kill bypass |
| Tax | autoPostTaxEntry + settle | VAT/PAYE | Double with embedded lines | TAX_* | Single tax authority |
| Equity | capital contributions engine | Capital 3100 | Weak keys; settings counter | CAPITAL / DRAWING / DIVIDEND | Registry identity |
| Imports | historical sales/expenses → helpers | varies | Batch duplicates | Import batch events | Preview + idempotency |
| Webhooks | none posting today | — | N/A if added later | Provider completion → payment event | Replay-safe design |
| Jobs | deferred GR; POS cash cron | — | Same as module | Same events | Idempotent jobs |

## Binding decisions carried into Phase 9

1. Authoritative posting API is `executePosting` (not transition `postAccountingEvent` for NEW_ENGINE).
2. Source–journal link is `AcctV2EventRegistry` (+ `getSourcePostingState`).
3. Templates already DEFINED for most events — Phase 9 implements `buildDraft` and activates behind flags.
4. Legacy remains authoritative until SHADOW threshold met then NEW_ENGINE per business/module/event.
5. Direct writers that bypass `assertLegacyPostingAllowed` must be shut down or routed through the guard before NEW_ENGINE.
