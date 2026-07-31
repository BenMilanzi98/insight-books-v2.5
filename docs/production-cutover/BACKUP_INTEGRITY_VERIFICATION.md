# BACKUP INTEGRITY VERIFICATION

| Field | Value |
|---|---|
| Phase | 18 — Production cutover |
| Document status | **STUB — pending production inputs** |
| Cutover execution | **NOT EXECUTED** |
| Branch | `v2` |
| Latest Prisma migration | `20260721200000_security_governance_v2` (~109 folders) |
| Last updated | July 2026 |

---

## Purpose

Phase 18 cutover document: **BACKUP INTEGRITY VERIFICATION**.

## Scope

Applies to InsightBooks V2 production migration on branch `v2`. **No production hostnames, backup IDs, migration run IDs, row counts, or financial totals are recorded until filled from live execution.**

## Prerequisites

- Phase 16 QA scaffolding: **green** (`test/qa/**`); full `npm test` / rehearsal: **PARTIAL — test/qa scaffolding green; full npm test / rehearsal sign-off UNKNOWN**
- Phase 17 capacity: **NOT CERTIFIED** — see `docs/performance-reliability/CAPACITY_CERTIFICATION.md`
- Migration scope freeze: **DRAFT** — see `MIGRATION_SCOPE_FREEZE.md`

## TO FILL FROM PRODUCTION

| Field | Value |
|---|---|
| Environment | _PENDING_ |
| Migration Run ID | _PENDING_ |
| Executed by | _PENDING_ |
| Evidence artifact path | _PENDING_ |

## Procedure (outline)

1. Complete `PRE_MIGRATION_DIAGNOSTIC_REPORT.md` on a production copy.
2. Execute governed steps in `MIGRATION_GOVERNANCE.md`.
3. Record deviations in `MIGRATION_EXCEPTION_REGISTER.md`.
4. Update `*_CONTROL_TOTALS.md` as applicable.

## Related documents

- `README.md` · `STOP_CONDITIONS.md` · `ROLLBACK_STRATEGY.md`
- Phase 18 master prompt section **§22**
