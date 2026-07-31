# Final System Audit — InsightBooks V2

| Field | Value |
|---|---|
| Generated | 2026-07-23T10:22:17.109Z |
| Inventory artifact | `artifacts/system-audit/inventory-counts.json` |
| Regenerator | `node scripts/generate-final-system-audit-docs.cjs` |
| Prior audit | `docs/system-audit/` |
| Production readiness | **NOT READY — BLOCKED** (see `FINAL_PRODUCTION_READINESS_DECISION.md`) |

## Scope

Forensic end-to-end review covering Chart of Accounts → Journals → GL → Trial Balance → financial statements, operational modules, multi-tenant isolation, security, responsiveness, and release gates.

## Inventory snapshot

| Metric | Count |
| --- | --- |
| UI pages (`app/**/page.js`) | 183 |
| API routes (`app/api/**/route.js`) | 740 |
| Prisma models | 307 |
| Migrations | 124 |
| Test files | 141 |
| Lib domain packages | 20 |
| Cron routes | 6 |

## Document index

All files in this folder contain **actual findings** (not empty stubs). Start with:

1. `FINAL_TASK_TRACKER.md` — ordered work status
2. `FINAL_GAP_REGISTER.md` — open gaps
3. `DEFECT_REGISTER.md` — severity-ranked defects
4. `FINAL_PRODUCTION_READINESS_DECISION.md` — go / no-go
5. `FINAL_SYSTEM_IMPLEMENTATION_REPORT.md` — executive narrative

Accounting integrity docs: `CHART_OF_ACCOUNTS_AUDIT.md`, `ACCOUNTING_POSTING_ENGINE.md`, `*_RECONCILIATION.md`.

## Authority hierarchy (enforced target)

```
Chart of Accounts
  → Posted Journal Entries / Lines (ACCOUNTING_V2)
    → General Ledger (projection)
      → Account Balances
        → Trial Balance
          → Financial Statements & Reports
```

Legacy `/api/reports/*` and stored `Account.balance` are **not** authoritative for V2 financial truth.
