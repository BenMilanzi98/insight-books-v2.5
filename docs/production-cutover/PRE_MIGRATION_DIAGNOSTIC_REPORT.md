# Pre-Migration Diagnostic Report

| Field | Value |
|---|---|
| Phase | 18 — Production cutover |
| Document status | **TEMPLATE** |
| Cutover execution | **NOT EXECUTED** |
| Branch | `v2` |
| Latest Prisma migration | `20260721200000_security_governance_v2` (~109 folders) |
| Last updated | July 2026 |

---

Run via `scripts/cutover-pre-migration-diagnostic.cjs` or `GET /api/system/cutover/diagnostics`. Checks: unbalanced journals, duplicates, NULL tenantId, TB diff, outbox — all _PENDING_.
