# Repository Accounting Map

Every file that reads or writes financial data, from the full-repo sweep. Risk levels reflect
journal impact + defect findings (cross-referenced to `ACCOUNTING_POSTING_MATRIX.md` and
`FINANCIAL_REPORT_LINEAGE.md`).

## Posting engine (writes journals)

| File | Function/Role | Reads | Writes | Journal impact | Risk |
|---|---|---|---|---|---|
| `lib/accountingEngine/postGlEntry.js` | Canonical GL post | Account, AccountingPeriod | Transaction+lines, Account.balance | Creates | Low (engine itself) — **no account-tenancy check (SEC-1)** |
| `lib/accountingEngine/postGlEntryBatch.js` | Batch wrapper | — | same | Creates | Low |
| `lib/accountingEngine/reverseGlEntry.js` | Reversal | Transaction | Transaction (reversal) | Creates | Low |
| `lib/accountingEngine/postManualJournalEntry.js` + `lib/journalService.js` | Manual journals | JournalEntry | **JournalEntry+lines**, Account.balance | Creates (second ledger) | **High** — closed-only period check, posts into period gaps |
| `lib/accountingEngine/buildLinesFromLegacy.js` | Line builders | — | — | helper | Low |
| `lib/accountBalanceService.js` | Stored balance maintenance | both ledgers | **Account.balance** | Direct balance updates | **Critical** (unserialized read-modify-write; two rebuild fns disagree) |

## Module posting helpers (write journals)

| File | Business events | Ledger | Risk |
|---|---|---|---|
| `lib/transactionJournalHelpers.js` | sales, invoices, invoice payments, credit/debit notes | T | High (gross revenue + separate tax; unstable payment keys) |
| `lib/taxCalculationService.js` | sale/invoice tax, settlements, WHT offsets, tax reversals | T | Medium |
| `lib/expenseGlPosting.js` | expense approval backfill | T | Low |
| `lib/paymentGlPosting.js` | transfers, adjustments | T | Medium (adjustments credit equity) |
| `lib/cogsIntegration.js` | legacy COGS/purchase/supplier-payment APIs | T | **High** (parallel legacy path) |
| `lib/purchaseAccounting.js` | goods receipts (J-only), supplier payments (T+J dual), owner assets (dual), cancel slices | **T+J+AB** | **Critical** |
| `lib/supplierBillExpenseFinalize.js` | expense bills | T | Medium |
| `lib/inventoryWriteOffJournal.js` + `inventoryWriteOffService.js` | write-offs | T | Medium |
| `lib/payrollEngine/` + `app/api/payroll/enhanced` | payroll runs | T | **Critical** (double post with process-route expense) |
| `lib/openingBalanceService.js` | opening balances | T | Low (best idempotency) |
| `lib/capitalCoaHelpers.js`, `resolveCapitalAccount.js`, `capitalContributionsQuery.js` | capital contributions/subaccounts | T + TenantSettings counter | **High** (settings counter double-count surface) |
| `lib/transactionReversalService.js`, `reversalValidation.js`, `financialReversalHelpers.js` | all reversals | T (mixed engine/direct) | **High** (direct-create branches, closed-only checks) |
| `lib/posCashDayService.js` | POS cash days, deposits | **AB only** | **Critical** (no journal) |
| `lib/core.js` | `updateAccountBalance`, `processCapitalTransfer` | **AB/Acct only** | **Critical** (legacy, no journal) |
| `lib/supplierBillCancelPayments.js` | bill-cancel payment restore | AB | High |
| `app/api/assets/route.js` | asset acquisition | T (direct create, no balance update, no sourceId) | **Critical** |
| `app/api/liabilities/**` | liability lifecycle | J + empty T header + AB + Expense | **Critical** |
| `app/api/invoices/refund`, `[id]/delete`, `lib/invoiceDeleteService.js` | invoice refund/delete reversals | T (direct create) | **Critical** |
| `app/api/purchases/payments/route.js` | supplier payment + unbalanced tax line | T+J | **Critical** |
| `app/api/expenses/partial-payment` | non-supplier partial payment | T (re-debits expense) | **Critical** |

## Reporting / read paths

| File | Role | Source | Risk |
|---|---|---|---|
| `lib/officialLedgerEngine.js`, `trialBalanceReport.js`, `reportingEngine/` | canonical GL reports | dual-ledger posted lines | Low |
| `lib/balanceSheetService.js` | legacy BS | stored balances + operational | **Critical residual** |
| `lib/incomeStatementService.js` | legacy IS | Payment/Sale/Expense | **Critical residual** |
| `lib/cashFlowGlService.js` / `cashFlowService.js` | cash flow | GL (narrow) / operational | High (multi-tenant path operational) |
| `lib/arAgingService.js` / `apAgingService.js` | AR/AP aging | operational + advisory GL check | **High** |
| `lib/dashboardGlMetrics.js` + `app/api/dashboard/*` | dashboards | GL with operational fallback; cash-flow dashboard uses stored AccountBalance | High |
| `lib/coaBulkGlAggregation.js`, `coaStructureDisplayBalance.js`, `coaAccountBalanceBreakdown.js` | CoA balances | GL-first with subledger/`Account.balance` fallback | Medium |
| `lib/glReconciliation.js`, `reportIntegrityService.js`, `coaPostingIntegrityAudit.js` | existing integrity tooling | GL | Low |
| `app/api/reports/*` (~40 routes) | statements/exports | see `FINANCIAL_REPORT_LINEAGE.md` per route | Mixed |

## Period / CoA / config

| File | Role | Risk |
|---|---|---|
| `lib/accountingPeriodService.js` | `assertPeriodOpen` (fail-open on zero periods and on unexpected errors) | High |
| `app/api/accounting-periods/**` | period CRUD/close/reopen (balanced-close + reconciliation gate) | Low |
| `lib/chartOfAccountsBlueprint.js`, `chartOfAccountsInitialization.js`, `applySystemCoaToAllTenants.js` | CoA provisioning | Low |
| `lib/accountingMappingRules.js` | expense account rules + duplicate-source assert (TOCTOU) | High |
| `lib/coaDirectPostingEligibility.js` | parent/retired posting blocks — **no tenant filter (SEC-1)** | Critical |
| `lib/coaPostingCodes.js`, `cogsGlAccount.js`, `inventoryGlAccount.js`, `salaryAdvanceGlAccount.js`, `openingBalanceEquityAccount.js`, `defaultRevenueAccount.js`, `paymentMethodAccountMapping.js` | hardcoded code resolvers with ensure/auto-create | Medium |
| `lib/accountMergeRollup.js`, `coaMigration/` | merge/migration machinery | Medium |

## Scripts (operator-run, write-capable)

`scripts/sync-existing-data-to-accounts.js`, `backfill-legacy-gl.cjs`,
`consolidate-salary-accounts.js`, `remap-accounting-mappings.js`, `fix-orphaned-transactions.js`,
`normalize-expense-categories.js` — all mutate financial data outside the engine; treated as
High-risk import/migration surface. Read-only audit tooling: `scripts/audit-gl.cjs`,
`scripts/audit-accounting-mapping.js`, **`scripts/accounting-forensic-audit.mjs` (Phase 1)**.

## Webhooks / jobs / listeners

No event-listener or queue framework; payment-gateway callbacks limited to subscription
billing (`app/api/subscription*`) which does not post to the GL. Cron-style routes are gated by
`CRON_SECRET` and do not post journals.
