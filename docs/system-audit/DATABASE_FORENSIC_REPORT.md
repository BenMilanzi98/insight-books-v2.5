# Database Forensic Report

| Field | Value |
|---|---|
| Engine | PostgreSQL via Prisma ORM |
| Schema | `prisma/schema.prisma` |
| Migrations | **109** folders (through `20260721200000_security_governance_v2`) |
| Models | **234** |
| Indexes / uniques | **647** (`@@index` + `@@unique` in schema) |
| Production forensic run | **PENDING**

---

## Schema overview

InsightBooks V2 uses a single PostgreSQL database with tenant-scoped business data. The schema combines:

1. **Legacy core** — `Account`, `JournalEntry`, `Transaction`, operational tables (sales, expenses, payroll, inventory).
2. **Accounting V2 layer** — parallel canonical journal model (`AcctV2*`), events, outbox, feature flags, periods.
3. **Domain V2 modules** — bank reconciliation, equity, close, planning, loan readiness, security governance (20260720–20260721 migration wave).

Latest migration: **`20260721200000_security_governance_v2`**.

---

## Migration timeline (V2 wave)

| Date prefix | Migration | Domain |
|---|---|---|
| 20260720110000 | acctv2_foundation | V2 tables, flags |
| 20260720130000 | coa_v2_governance | CoA governance |
| 20260720160000 | acctv2_posting_engine | Posting engine persistence |
| 20260720200000 | acctv2_ledger | Ledger projection |
| 20260720210000 | acctv2_repair | Repair batches/anomalies |
| 20260720220000 | acctv2_reporting | Report runs/cache |
| 20260721080000 | acctv2_financial_calendar | Periods / FY |
| 20260721120000 | bank_reconciliation_v2 | Bank recon |
| 20260721140000 | equity_management_v2 | Equity |
| 20260721160000 | year_end_close_v2 | Close |
| 20260721170000 | preenable_accounting_close_v2 | Close pre-enable |
| 20260721180000 | financial_planning_v2 | Planning (no GL FK) |
| 20260721190000 | loan_readiness_v2 | Loan readiness (no GL FK) |
| 20260721200000 | security_governance_v2 | Security governance |

Full list: `artifacts/system-audit/inventory-counts.json` → `migrations[]`.

---

## Forensic tooling (exists in repo)

| Script | Purpose |
|---|---|
| `scripts/accounting-forensic-audit.mjs` | Read-only multi-module accounting audit (`npm run audit:forensic`) |
| `scripts/validate-data-integrity.js` | FK, orphans, balance consistency |
| `scripts/audit-gl.cjs` | GL-focused checks |
| `scripts/audit-account-references.js` | Account reference integrity |
| `scripts/audit-accounting-mapping.js` | Mapping consistency |
| `scripts/audit-coa-consolidation-postings.mjs` | CoA consolidation postings |
| `scripts/rbac-audit.js` | RBAC review |
| `scripts/generate-schema-inventory.py` | Schema inventory export |
| `lib/accountingAudit/*` | Reusable audit modules (journals, ledger, TB, CoA, capital, AR/AP) |

Phase 1 documentation: `docs/accounting-audit/DATABASE_SCHEMA_AUDIT.md`.

---

## Structural risks (from prior audits — not re-run here)

| Risk | Reference | Status |
|---|---|---|
| Nullable `Account.tenantId` (global template rows) | COA-012 / Phase 3 | Structural — constraint tightening deferred |
| Status casing drift on journals | R-13 / TB-003 | Documented in Phase 1 |
| Dual ledger (Transaction + JournalEntry + AcctV2) | R-22 | Migration in progress |
| Outbox table without dispatcher | P2-06 | Open — `SYSTEM_DEFECT_REGISTER.md` |

---

## Recommended forensic procedure

```bash
# 1. Schema deploy check (staging/prod copy)
npx prisma migrate status

# 2. Read-only accounting forensic (scoped)
npm run audit:forensic
node scripts/accounting-forensic-audit.mjs --business <tenantId> --verbose

# 3. Data integrity (mutating checks — run on copy first)
node scripts/validate-data-integrity.js

# 4. Refresh inventory
node scripts/generate-system-audit-inventory.cjs
```

**Write safety:** `accounting-forensic-audit.mjs` asserts row counts unchanged; always run integrity script against a **copy** until validated read-only.

---

## Production status

No production host forensic results are attached to this system audit pass. Append JSON/CSV outputs from `artifacts/accounting-audit/` (git-ignored) when a production copy run completes.

See also: `DATA_INTEGRITY_REPORT.md`, `docs/production-cutover/POST_MIGRATION_DATABASE_VALIDATION.md`.
