# Production Backup Plan

| Field | Value |
|---|---|
| Phase | 18 — Production cutover |
| Document status | **DRAFT** |
| Cutover execution | **NOT EXECUTED** |
| Branch | `v2` |
| Latest Prisma migration | `20260721200000_security_governance_v2` (~109 folders) |
| Last updated | July 2026 |

---

Use `scripts/backup-database.sh` + `scripts/safe-deploy-production.sh`. Restore must pass `BACKUP_RESTORE_VERIFICATION.md` before migrate. **NOT EXECUTED on production.**
