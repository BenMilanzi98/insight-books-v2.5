# Data Integrity Report

| Field | Value |
|---|---|
| Primary script | `scripts/validate-data-integrity.js` |
| Accounting forensic | `scripts/accounting-forensic-audit.mjs` (`lib/accountingAudit/`) |
| Production full run | **PENDING** |
| Status | **PENDING full prod run**

---

## Scope

Data integrity validation covers:

1. **Foreign key validity** — operational records reference existing accounts, categories, tenants.
2. **Orphan detection** — records without parent entities or without expected GL linkage.
3. **Balance consistency** — stored account balances vs journal-derived totals (via forensic audit modules).
4. **Multi-tenant isolation** — cross-tenant references flagged (see `ledgerReconciliationAudit.js`).

This report does **not** claim a production database has been validated in this audit pass.

---

## Tools

### `scripts/validate-data-integrity.js`

Node script using Prisma. Sections include:

- Foreign key validation on expenses (account, category when column exists)
- Additional checks for invoices, payments, journal entries (see script body)
- Color-coded console output for errors/warnings

**Usage:**

```bash
node scripts/validate-data-integrity.js
# Optional tenant scoping — see script for TENANT_ID env or args
```

Run against **staging or production copy** first. Script may perform read-heavy queries.

### `scripts/accounting-forensic-audit.mjs`

Read-only orchestrator over `lib/accountingAudit/` modules. Modules: journals, ledger, trial-balance, sources, coa, periods, reversals, capital, ar-ap.

```bash
npm run audit:forensic
node scripts/accounting-forensic-audit.mjs --business <tenantId> --module journals,ledger
```

Artifacts → `artifacts/accounting-audit/` (git-ignored).

---

## Expected outputs (when run)

| Check | Pass criteria | Failure action |
|---|---|---|
| FK validation | Zero invalid references | Log defect → `SYSTEM_DEFECT_REGISTER.md` |
| Orphan sources | Zero critical orphans per module | Source linkage repair backlog |
| TB balance | Debits = credits per tenant | Block close / cutover |
| Stored vs derived GL | Within tolerance / zero | Ledger rebuild candidate |
| Row count invariant | Audit run did not mutate data | Abort if counts change |

---

## Current status

| Environment | Last run | Result |
|---|---|---|
| Developer local DB | Phase 1 accounting audit (2026) | Documented in `docs/accounting-audit/` — blueprint-clean local dataset |
| Production copy | — | **NOT RUN** |
| Production live | — | **NOT RUN** |

---

## Integration with cutover

Phase 18 requires post-migration validation per `docs/production-cutover/POST_MIGRATION_DATABASE_VALIDATION.md` and control totals in `FINANCIAL_CONTROL_TOTALS.md`.

Until production copy results exist, release readiness remains **NOT READY** (`RELEASE_READINESS_REPORT.md`).

---

## Next steps

1. Provision read-only production replica or sanitized copy.
2. Run forensic audit all modules → store CSV/JSON under `artifacts/accounting-audit/`.
3. Run `validate-data-integrity.js` → append summary table here.
4. Cross-reference anomalies with `SYSTEM_DEFECT_REGISTER.md`.
