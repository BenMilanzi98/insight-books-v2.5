# Production Data Flow Map

Logical map of how data enters, is transformed, and is reported in InsightBooks V2. Production-specific volumes and hostnames are **not recorded** until inventory is complete.

| Field | Value |
|---|---|
| Phase | 18 — Production cutover |
| Document status | **DRAFT** |
| Cutover execution | **NOT EXECUTED** |
| Branch | `v2` |
| Latest Prisma migration | `20260721200000_security_governance_v2` (~109 folders) |
| Last updated | July 2026 |

---

## High-level flow

```
Operational modules (Sales, Expenses, Payroll, Banking, …)
        │
        ▼
Posting Engine (lib/accountingV2/postingEngine.js)
        │ idempotent events + templates
        ▼
Journal Entries / Lines
        │
        ├──► General Ledger / rebuild
        ├──► Trial Balance / Financial reports
        └──► Subledgers (AR, AP, Bank recon, Equity)
```

---

## Domain flows

| Domain | Posts to GL? | Cutover doc |
|---|---|---|
| Sales / AR | Yes | `RECEIVABLES_MIGRATION.md` |
| Expenses / Payroll | Yes | `EXPENSE_MIGRATION.md`, `PAYROLL_MIGRATION.md` |
| Banking / Bank recon | Yes | `BANKING_MIGRATION.md`, `BANK_RECONCILIATION_MIGRATION.md` |
| Equity / Year-end close | Yes | `EQUITY_MIGRATION.md`, `PERIOD_AND_YEAR_END_MIGRATION.md` |
| Financial planning | **No** | `FORECAST_MIGRATION.md` |
| Loan readiness | **No** | `LOAN_READINESS_MIGRATION.md` |

---

## Cutover-sensitive components

| Component | Cutover doc |
|---|---|
| Transactional outbox | `OUTBOX_RECONCILIATION.md` |
| Report cache | `REBUILDABLE_DATA_PLAN.md` |
| Cron / background jobs | `BACKGROUND_JOB_FREEZE.md` |
| Integrations | `INTEGRATION_PAUSE_AND_RESUME.md` |

---

## TO FILL FROM PRODUCTION

| Integration | Direction | Protocol |
|---|---|---|
| _PENDING_ | _PENDING_ | _PENDING_ |

See also `PRODUCTION_DEPENDENCY_MAP.md` and `PRODUCTION_DATA_INVENTORY.md`.
