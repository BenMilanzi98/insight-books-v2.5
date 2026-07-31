# Test Database Environment

How PostgreSQL is used (and not used) in InsightBooks V2 automated testing.

---

## Environments

| Environment | Used by | Required? |
|---|---|---|
| **None (in-memory)** | Most Vitest tests, all `test/qa/**` | Default — always |
| **Local PostgreSQL** | Developer integration, scenario script | Optional |
| **CI secret DB** | `verify:accounting-scenario` when `DATABASE_URL` set | Optional in PR |
| **Staging QA tenant** | Nightly / pre-release | Target for G5 gate |
| **Disposable DB** | Migration rehearsal only | Manual (Phase 17 CI) |

---

## QA-Accounting tenant

**Script:** `scripts/verify-accounting-scenario.cjs`  
**Guard:** `test/helpers/dbIntegrationGuard.js` → `tenantExistsForIntegration('QA-Accounting')`

| Scenario key | Check |
|---|---|
| `pos-sale-gl` | Posted Sale + Sale-COGS |
| `invoice-accrual-gl` | Invoice accrual GL |
| `expense-approved-gl` | Expense GL |
| `trial-balance` | TB debits = credits |
| `txn-balance` | Per-txn balance |
| `source-idempotency` | No duplicate sourceType+sourceId |
| `ar-subledger` | AR 1200 vs invoices |

**Manifest:** `scripts/.qa-scenario-manifest.json`

---

## CI behaviour

```yaml
# .github/workflows/accounting-verify.yml
- npm run test:pr-fast          # no DB
- npm test                      # no DB (skipIf suites skip)
- verify:accounting-scenario    # only if secrets.DATABASE_URL
```

**Gap:** GAP-QA-014 — three CoA files skip silently without tenant. **Planned:** `qaTenantFactory.js` + seed job (BE).

---

## Local setup

```bash
# Ensure DATABASE_URL points at local/staging — never production
npx prisma generate
npm run verify:accounting-scenario -- --tenant=QA-Accounting
```

Integration tests using `describe.skipIf(!tenantReady)`:

- `expenseCoaCategoryPicker.test.js`
- `salaryAdvanceGlAccount.test.js`
- `coaExpenseTenantPipeline.test.js`

---

## Safety rules

1. Never commit production connection strings.
2. Migration rehearsal uses **throwaway** database (`MIGRATION_REHEARSAL_RUNBOOK.md`).
3. Scenario script is **read-only** on QA tenant.

---

## Related documents

- `TEST_DATA_ARCHITECTURE.md`
- `SYNTHETIC_DATA_AND_PRIVACY.md`
- `CI_QUALITY_GATES.md` — Gate G5
- `MIGRATION_REHEARSAL_RUNBOOK.md`

---

## Document status

| Field | Value |
|---|---|
| Version | 1.0 |
| Last updated | July 2026 |
| Owner | BE (QA tenant seed job) |
