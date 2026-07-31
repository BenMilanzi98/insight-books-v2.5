# Test Data Architecture

How test data is constructed, seeded, and isolated in InsightBooks V2 QA.

---

## Layers

| Layer | Mechanism | Mutable | Used by |
|---|---|---|---|
| **L0 — Pure fixtures** | In-test objects, no I/O | N/A | Most unit tests |
| **L1 — Prisma stub** | `makeAcctV2PrismaStub(seed)` | In-memory | `accountingV2.*.test.js` |
| **L2 — Audit stub** | Inline `makePrismaStub` in test file | In-memory | `accountingAudit.test.js` |
| **L3 — QA tenant (DB)** | PostgreSQL tenant `QA-Accounting` | Read-mostly | `verify-accounting-scenario.cjs`, skipIf tests |
| **L4 — Manifest** | `scripts/.qa-scenario-manifest.json` | Versioned | Scenario script expected IDs |

---

## acctV2PrismaStub seed model

**File:** `test/helpers/acctV2PrismaStub.js`

Default seed arrays (all optional overrides):

| Collection | Purpose |
|---|---|
| `eventRegistry` | Idempotency / duplicate detection |
| `accounts` | CoA for posting & reports |
| `accountingPeriods` / `accountingPeriodsV2` | Period control |
| `legacyTransactions` / `transactionLines` | Dual-ledger reads |
| `legacyJournalEntries` / `journalEntryLines` | V2 canonical source |
| `repairBatches`, `anomalies` | Repair module |
| `reportRuns`, `reportSnapshots` | Reports V2 |
| `invoices`, `supplierBills`, `budgetItems` | Subledger/report inputs |

**Features:**
- P2002 on duplicate registry keys
- `$transaction` rollback via snapshot
- `simulateRaceOnce` for race idempotency tests

**Convention:** Tenant IDs `tenant-1` / `tenant-2` (T1/T2) in V2 tests for cross-tenant cases.

---

## DB integration guard

**File:** `test/helpers/dbIntegrationGuard.js`

```javascript
await tenantExistsForIntegration('QA-Accounting')  // → boolean
```

**Consumers:**
- `expenseCoaCategoryPicker.test.js`
- `salaryAdvanceGlAccount.test.js`
- `coaExpenseTenantPipeline.test.js`

**Requirement:** Real `Tenant` row with `name = 'QA-Accounting'` (or pass `--tenant-id` to scenario script).

---

## QA-Accounting tenant (operational)

Used by `scripts/verify-accounting-scenario.cjs`:

| Scenario | Data dependency |
|---|---|
| pos-sale-gl | Posted Sale + Sale-COGS transactions |
| invoice-accrual-gl | Posted Invoice GL |
| expense-approved-gl | Posted Expense GL |
| trial-balance | Full posted set, TB balances |
| txn-balance | All posted txns balanced |
| source-idempotency | Unique sourceType+sourceId |
| ar-subledger | AR account 1200 vs open invoices |

Manifest pins expected transaction IDs when present (`scripts/.qa-scenario-manifest.json`).

**CI:** Runs only when `secrets.DATABASE_URL` configured (`.github/workflows/accounting-verify.yml`).

---

## Canonical account codes in tests

Evidence from test fixtures (not invented):

| Code | Role | Example files |
|---|---|---|
| **5200** | Salaries & Wages (canonical) | `accountingV2.reports.test.js`, `legacyExpenseAccountRemaps.test.js` |
| **5000** | Operating expense header / COGS | `accountingV2.reports.test.js`, rollup tests |
| **5301** | Retired salary duplicate | rollup remaps to 5200 |
| **1200** | AR control | scenario script, reports tests |
| **3100** | Owner's capital | equity / CAP-005 tests |

---

## Planned helpers (Phase 16 infra)

### `test/helpers/httpTestClient.js` — **NOT_STARTED**

- Build Next.js route handler requests with session cookie
- Support `ActorContext` test users (roles/permissions matrix)
- No production secrets — use test signing key env `TEST_SESSION_SECRET`

### `test/helpers/qaTenantFactory.js` — **NOT_STARTED**

- Minimal CoA: 1000, 1200, 5200, 5000, 3100, cash, equity
- One open period Jun 2026
- Idempotent seed for CI job (workstream BE)

---

## Data isolation rules

1. **Unit tests** must not require shared DB (except explicit skipIf integration).
2. **Never** point tests at production `DATABASE_URL`.
3. Cross-tenant tests use **distinct stub tenant IDs**, never real tenant names.
4. Scenario script is **read-only** — no writes to QA tenant.
5. Migration rehearsal uses **disposable database** only (`MIGRATION_REHEARSAL_RUNBOOK.md`).

---

## PII & secrets in tests

| Rule | Implementation |
|---|---|
| No real customer PII | Fictional names in stubs |
| No `.env` in CI logs | GitHub secrets for DATABASE_URL |
| Redact in audit tests | `redactForAudit` covered in engine test |

---

## Related documents

- `MIGRATION_TEST_STRATEGY.md` — cutover data
- `CI_QUALITY_GATES.md` — when DB jobs run
- `FLAKY_AND_SKIPPED_TEST_REGISTER.md` — skipIf behaviour
