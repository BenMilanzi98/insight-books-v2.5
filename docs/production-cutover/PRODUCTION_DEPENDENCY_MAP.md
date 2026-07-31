# Production Dependency Map

| Field | Value |
|---|---|
| Phase | 18 — Production cutover |
| Document status | **DRAFT** |
| Cutover execution | **NOT EXECUTED** |
| Branch | `v2` |
| Latest Prisma migration | `20260721200000_security_governance_v2` (~109 folders) |
| Last updated | July 2026 |

---

| Dependency | Production value |
|---|---|
| PostgreSQL | **TO FILL FROM PRODUCTION** |
| PM2 `insight-books` | Verify on server |
| V2 APIs | `/api/accounting-v2`, `/api/coa-v2`, `/api/bank-reconciliation`, etc. |
| Cutover API | `/api/system/cutover/*` (scaffolding) |

## Blocking gates

| Gate | Status |
|---|---|
| Capacity cert | **NOT CERTIFIED** |
| QA Phase 18 entry | **NOT MET** |
| Phase 15 exit | **NOT MET** |
