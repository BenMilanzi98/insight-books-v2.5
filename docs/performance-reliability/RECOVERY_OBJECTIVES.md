# Recovery Objectives

Recovery Point Objective (RPO) and Recovery Time Objective (RTO) for InsightBooks V2.

**Status: DRAFT — not validated until timed restore drill completed.**

---

## Definitions

| Term | Meaning |
|---|---|
| **RPO** | Maximum acceptable data loss (time of last recoverable backup) |
| **RTO** | Maximum acceptable downtime to restore service |

---

## Draft targets

| Tier | RPO (DRAFT) | RTO (DRAFT) | Basis |
|---|---|---|---|
| Financial platform (pilot) | 24 hours | 4 hours | Daily backup assumption |
| Financial platform (target) | 1 hour | 1 hour | PITR + rehearsed runbook |
| Non-prod staging | 7 days | 8 hours | Best effort |

---

## Validation required

| Step | Evidence location |
|---|---|
| Document backup schedule | Ops runbook |
| Perform restore to clean environment | [DISASTER_RECOVERY_RUNBOOK.md](./DISASTER_RECOVERY_RUNBOOK.md) |
| Record wall-clock restore time | This doc → promote RTO to **CERTIFIED** |
| Verify journal integrity post-restore | `scripts/verify-accounting-scenario.cjs` |

**Current certification:** **NOT CERTIFIED** (PR-09).

---

## Data scope

Must restore:

- PostgreSQL (all tenants)
- Uploaded files (`public/uploads` volume in Docker)

---

## Cross-links

- [docs/DOCKER_RESTORE_SOLUTION.md](../DOCKER_RESTORE_SOLUTION.md)
- [quality-assurance/MIGRATION_REHEARSAL_RUNBOOK.md](../quality-assurance/MIGRATION_REHEARSAL_RUNBOOK.md)
