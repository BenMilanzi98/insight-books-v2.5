# Current Architecture (Verified)

Recorded at Git commit `5b59a68c9ac5a07ee90fb76adf6fdf17a6700de0` (branch `v2`), 2026-07-20.
All statements below verified by direct inspection, not assumed.

## Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router, `app/` directory) | ^16.2.9 |
| Runtime | Node.js | v24.11.0 |
| UI | React | ^19 |
| ORM | Prisma Client | ^6.19 (schema in `prisma/schema.prisma`, 3,081 lines, 124 models) |
| Database | PostgreSQL 18.4 (local dev: Scoop install, `localhost:5432/insightbooksmw`) | — |
| Auth | Custom session cookie (base64 JSON) via `lib/auth.js` + `middleware.js`; bcrypt password hashing; Google OAuth | — |
| Authorization | Role-based permissions per tenant (`Role.permissions` JSON, `lib/permissions*.js`, `lib/tenantApiAccess.js`) | — |
| Multi-tenancy | Single database, shared tables discriminated by `tenantId`; `TenantMembership` many-to-many; branch scoping via `branchId` | — |
| Testing | Vitest (`test/*.test.js`, ~70 suites) | ^4.1 |
| Exports | exceljs, jspdf, puppeteer | — |
| Money | `Decimal(18,2)` on newer tables; **Float on several older tables** (see schema audit) | — |
| Jobs/webhooks | No queue framework found; payment gateway callbacks under `app/api/subscription*`; cron-style routes protected by `CRON_SECRET` | — |

## The two-and-a-half ledgers (central architectural fact)

The system contains **two journal ledgers plus a stored-balance layer**:

1. **`Transaction` + `TransactionLine`** — the primary GL. Written by the central engine
   `lib/accountingEngine/postGlEntry.js`. Lines use `Decimal(18,2)`. Header carries
   `sourceType`/`sourceId` (idempotency), reversal linkage, branch, posted-by.
2. **`JournalEntry` + `JournalEntryLine`** — a second ledger. Newer code writes balanced
   *line-based* entries (manual journals). **Legacy rows store amounts on the header**
   (`JournalEntry.debit` / `JournalEntry.credit` as `Float`) with **zero lines** — one-sided
   rows that only balance in pairs.
3. **Stored balances** — `Account.balance` (`Decimal(18,2)`) is incrementally updated on every
   posting by `lib/accountBalanceService.js#updateAccountBalanceOnTransaction`. There are also
   an `AccountBalance` table (tenant+account-name keyed, `Float`, currently empty locally) and
   `AccountBalanceHistory` (period snapshots at close), and `EquityAccount` rows with their own
   `currentBalance`.

Reporting services (`lib/trialBalanceReport.js`, `lib/officialLedgerEngine.js`,
`lib/accountingReportService.js`) aggregate **both ledgers**, excluding `JournalEntry` rows whose
`transactionId` is set (treated as mirrors of a `Transaction`). Legacy header-amount rows (no
lines) are **excluded by line-based aggregation but included in the stored balances** — a proven
source of report-vs-CoA divergence (see `CAPITAL_AND_EQUITY_AUDIT.md`).

## Accounting-related directories

| Area | Location |
|---|---|
| Posting engine | `lib/accountingEngine/` (`postGlEntry`, `postGlEntryBatch`, `reverseGlEntry`, `postManualJournalEntry`, `buildLinesFromLegacy`, `constants`) |
| Module posting helpers | `lib/paymentGlPosting.js`, `lib/expenseGlPosting.js`, `lib/cogsIntegration.js`, `lib/purchaseAccounting.js`, `lib/transactionJournalHelpers.js`, `lib/inventoryWriteOffJournal.js`, `lib/payrollEngine/`, `lib/capitalCoaHelpers.js`, `lib/openingBalanceService.js` |
| Balance maintenance | `lib/accountBalanceService.js` |
| Period control | `lib/accountingPeriodService.js` (`assertPeriodOpen`), `app/api/accounting-periods/` |
| Reversals | `lib/transactionReversalService.js`, `lib/accountingEngine/reverseGlEntry.js`, `lib/reversalValidation.js` |
| Reports | `app/api/reports/*` (~40 routes), `lib/trialBalanceReport.js`, `lib/balanceSheetService.js`, `lib/incomeStatementService.js`, `lib/cashFlowGlService.js`, `lib/arAgingService.js`, `lib/apAgingService.js`, `lib/officialLedgerEngine.js` |
| Dashboards | `app/api/dashboard/*`, `lib/dashboardGlMetrics.js` |
| CoA | `lib/chartOfAccountsBlueprint.js`, `lib/chartOfAccountsInitialization.js`, `lib/coa*.js` (~30 files), `lib/accountMergeRollup.js` |
| GL integrity (existing) | `lib/glReconciliation.js`, `lib/coaPostingIntegrityAudit.js`, `lib/reportIntegrityService.js`, `scripts/audit-gl.cjs` |
| Phase 1 audit engine (new) | `lib/accountingAudit/` + `scripts/accounting-forensic-audit.mjs` |

## Tenancy & authentication flow

- Session cookie decoded by `getUserFromSession` (`lib/auth.js`); handlers derive `tenantId`
  from the session user, not from client parameters (spot-checked; exceptions noted in
  `MULTI_TENANT_AND_SECURITY_AUDIT.md`).
- `middleware.js` guards page/API access; per-route RBAC via `requirePermission` /
  `requireAnyPermission`.
- Branch scoping is soft (nullable `branchId` on transactions).

## Environments & deployment

- Local dev: Laragon on Windows, PostgreSQL via Scoop, `.env` `DATABASE_URL`.
- Docker: `docker-compose.yml` (app + postgres 15-alpine), used for other environments.
- Production: `APP_URL=http://213.165.230.139:3000` per `.env`; Prisma migrations (95) baselined.
- Local DB row counts at audit time: 19 `Transaction`, 39 `TransactionLine`, 6 `JournalEntry`,
  8 `JournalEntryLine`, 540 `Account`, 5 tenants — QA-seeded dataset. **Production-scale audit
  must be re-run against a restored production copy** (same commands).

## Current test coverage

~70 Vitest suites covering money rounding, posting eligibility, CoA rollups, expense GL,
reversal lookup, tenant scope, reporting rules. No suite previously reconstructed the GL or trial
balance independently — the Phase 1 audit engine adds that.
