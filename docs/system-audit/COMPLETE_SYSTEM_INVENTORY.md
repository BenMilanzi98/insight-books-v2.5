# Complete System Inventory

| Field | Value |
|---|---|
| Source | `artifacts/system-audit/inventory-counts.json` |
| Generated | 2026-07-22T10:28:11Z (refresh: `node scripts/generate-system-audit-inventory.cjs`) |
| Status | **REAL counts from artifact** |

---

## Summary counts

| Category | Count | Notes |
|---|---:|---|
| UI pages (`app/**/page.js`) | **157** | Includes auth, dashboard, HR, POS, InsightBooks admin, V2 surfaces |
| API routes (`app/api/**/route.js`) | **681** | Next.js App Router handlers |
| Prisma models | **234** | `prisma/schema.prisma` |
| Prisma migrations (folders) | **109** | Through `20260721200000_security_governance_v2` |
| Test files (`test/**/*.test.js`, `*.spec.js`) | **106** | Vitest suites |
| Top-level `lib/` modules | **17** | Domain packages (see below) |
| Cron API jobs | **6** | `app/api/cron/**/route.js` |
| Schema indexes/uniques | **647** | `@@index` + `@@unique` in schema (glob count) |

---

## UI pages (157)

Discovery method: recursive `page.js` under `app/`. Full path list in inventory artifact `pages[]`.

**V2-first surfaces (sample)**

| Path | Module |
|---|---|
| `/general-ledger-v2` | Accounting V2 ledger |
| `/financial-calendar-v2` | Periods / financial years |
| `/reports-v2` | V2 reporting |
| `/chart-of-accounts/governance` | CoA V2 governance |
| `/bank-reconciliation` | Bank reconciliation V2 |
| `/equity-management` | Equity management V2 |
| `/accounting-close` | Year-end close V2 |
| `/financial-planning` | Financial planning V2 (advisory — no GL post) |
| `/loan-readiness` | Loan readiness V2 (advisory — no GL post) |
| `/security-governance` | Security governance V2 |
| `/system/accounting-architecture` | Architecture dashboard |
| `/system/accounting-posting-engine` | Posting engine ops |
| `/system/accounting-repair` | Repair / anomalies |
| `/maintenance` | Maintenance mode page |

**Legacy / operational surfaces (sample)** — dashboard, expenses, invoices, POS, payroll, stock, purchases, assets, tax, capital-account, journal-entries, general-ledger (v1), reports, HR subtree, InsightBooks SaaS admin (`app/insightbooks/**`).

---

## API routes (681)

Full list: inventory artifact `apis[]` (681 entries).

**V2 namespace route counts (sampled)**

| Prefix | Routes | Lib package |
|---|---:|---|
| `/api/accounting-v2` | 33 | `lib/accountingV2` |
| `/api/coa-v2` | 12 | `lib/coaV2` |
| `/api/bank-reconciliation` | 12 | `lib/bankReconciliation` |
| `/api/equity-management` | 10 | `lib/equityManagement` |
| `/api/accounting-close` | 6 | `lib/accountingClose` |
| `/api/financial-planning` | 12 | `lib/financialPlanning` |
| `/api/loan-readiness` | 6 | `lib/loanReadiness` |
| `/api/security-governance` | 7 | `lib/securityGovernance` |
| `/api/system` | 6 | `lib/productionCutover`, health probes |

Remaining ~587 routes cover legacy accounting, sales, purchases, HR, admin, mobile, EIS, etc.

---

## Prisma models (234)

All model names in artifact `models[]`. Major V2 additions (migrations 20260720–20260721):

- **Accounting V2** — `AcctV2Journal`, `AcctV2JournalLine`, `AcctV2Event`, `AcctV2OutboxMessage`, `AcctV2FeatureFlag`, period/calendar tables
- **CoA V2** — governance, mappings, consolidation plans, aliases
- **Bank reconciliation** — statements, matches, reconciliations
- **Equity management** — owners, holdings, transactions, dividends
- **Accounting close** — close runs, checklist items
- **Financial planning** — forecasts, scenarios, assumptions (no journal FK)
- **Loan readiness** — assessments, config (no journal FK)
- **Security governance** — sessions, API keys, approvals, audit events

Legacy core: `Tenant`, `User`, `Account`, `JournalEntry`, `Transaction`, `Invoice`, `Sale`, `Expense`, `Payroll`, inventory, assets, subscriptions.

---

## Migrations (109)

Chronological folder names in artifact `migrations[]`.

| Milestone | Migration folder |
|---|---|
| Init | `20200101000000_init` |
| CoA unify | `20260206120000_unify_coa_accounts` |
| Accounting V2 foundation | `20260720110000_acctv2_foundation` |
| Posting engine | `20260720160000_acctv2_posting_engine` |
| Ledger / repair / reporting | `20260720200000` – `20260720220000` |
| Financial calendar | `20260721080000_acctv2_financial_calendar` |
| Bank recon | `20260721120000_bank_reconciliation_v2` |
| Equity | `20260721140000_equity_management_v2` |
| Year-end close | `20260721160000_year_end_close_v2` |
| Financial planning | `20260721180000_financial_planning_v2` |
| Loan readiness | `20260721190000_loan_readiness_v2` |
| **Latest** | `20260721200000_security_governance_v2` |

---

## Lib modules (17 top-level)

From artifact `libModules[]`:

| Module | Role |
|---|---|
| `accountingAudit` | Read-only forensic audit engine |
| `accountingClose` | Year-end close domain |
| `accountingEngine` | Legacy posting (partially retired) |
| `accountingV2` | V2 posting engine, ledger, periods, reports, repair |
| `bankReconciliation` | Bank statement import, matching, completion |
| `coaMigration` | Legacy → V2 CoA migration helpers |
| `coaV2` | CoA governance, mappings, lifecycle |
| `equityManagement` | Owner equity, dividends, statements |
| `financialPlanning` | Forecasts/scenarios (**advisory — no GL**) |
| `loanReadiness` | Debt capacity assessments (**advisory — no GL**) |
| `payrollEngine` | Payroll calculations |
| `performanceReliability` | Health, metrics, capacity hooks (Phase 17) |
| `postingRules` | Shared posting rule helpers |
| `productionCutover` | Cutover gates, manifest (Phase 18) |
| `qa` | QA helpers |
| `reportingEngine` | Legacy + shared report builders |
| `securityGovernance` | Sessions, SoD, approvals, API keys |

Additional standalone files under `lib/` (560+ `.js` files) support legacy domains — not all are top-level packages.

---

## Background jobs (6 cron routes)

| Route | Purpose |
|---|---|
| `app/api/cron/daily-report/route.js` | Scheduled daily report |
| `app/api/cron/eis-sync/route.js` | EIS invoice sync |
| `app/api/cron/expire-trials/route.js` | Trial expiry |
| `app/api/cron/subscription-expiry-reminders/route.js` | Subscription reminders |
| `app/api/cron/apply-deferred-goods-receipts/route.js` | Deferred GRNI posting |
| `app/api/cron/pos-cash-day/route.js` | POS cash day register |

**Note:** Transactional outbox (`AcctV2OutboxMessage`) has **enqueue** implementation; **dispatcher worker is not implemented** (P2-06 / ARCH-005).

---

## Feature flags

Server-controlled flags in `lib/accountingV2/infrastructure/featureFlags.js`:

- **Accounting V2** — `accountingV2Enabled`, shadow mode, new journal schema, ledger projection, strict idempotency, etc.
- **CoA V2** — `coaV2Enabled`, salary enforcement, hierarchy validation, etc.
- **Reporting V2** — trial balance, financial reports, drill-down flags

Stored in DB table `AcctV2FeatureFlag` with tenant/global scope precedence. Defaults **OFF** for rollout flags.

---

## Tests (106 files)

Full list in artifact `tests[]`. Highlights:

- `test/accountingV2.*.test.js` — posting, ledger, periods, reports, repair
- `test/coaV2.*.test.js` — CoA governance
- `test/bankReconciliation.*.test.js` — bank recon domain
- `test/equityManagement.*.test.js` — equity workflows
- `test/financialPlanning.*.test.js` — planning engine
- `test/loanReadiness.engine.test.js` — loan readiness
- `test/securityGovernance.engine.test.js` — security governance
- `test/qa/**` — invariants, regression, multi-tenant, property tests

**Full `npm test` baseline:** not recorded — treat as **UNKNOWN** until CI artifact appended.
