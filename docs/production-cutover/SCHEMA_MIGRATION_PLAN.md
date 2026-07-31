# Schema Migration Plan

| Field | Value |
|---|---|
| Phase | 18 — Production cutover |
| Document status | **DRAFT** |
| Cutover execution | **NOT EXECUTED** |
| Branch | `v2` |
| Latest Prisma migration | `20260721200000_security_governance_v2` (~109 folders) |
| Last updated | July 2026 |

---

`npx prisma migrate deploy` → `20260721200000_security_governance_v2`. Post-check: `POST_MIGRATION_DATABASE_VALIDATION.md`.
