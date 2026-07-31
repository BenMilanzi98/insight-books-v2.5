# Migration Governance

| Field | Value |
|---|---|
| Phase | 18 — Production cutover |
| Document status | **DRAFT** |
| Cutover execution | **NOT EXECUTED** |
| Branch | `v2` |
| Latest Prisma migration | `20260721200000_security_governance_v2` (~109 folders) |
| Last updated | July 2026 |

---

Roles: sponsor, migration lead, finance, security, technical, QA, ops. Migration ledger fields: name, run ID, environment, commit, migration head, counts, rollback status — **no executed runs yet**.

Runtime: `lib/productionCutover/`, `/api/system/cutover/runs`. Scripts: `scripts/cutover-*.cjs`, `scripts/safe-deploy-production.sh`.
