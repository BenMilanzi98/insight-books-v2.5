# Disaster Recovery Runbook

Restore InsightBooks V2 after catastrophic failure. **Practice in staging before production reliance.**

---

## Prerequisites

- Backup file location documented (pg_dump / volume snapshot)
- `DATABASE_URL` for restore target
- Docker or bare-metal PostgreSQL 15 client tools
- `CRON_SECRET`, `SESSION_SECRET` secured off-host

References: [docs/DOCKER_RESTORE_SOLUTION.md](../DOCKER_RESTORE_SOLUTION.md), [docs/RESTORE_DATABASE_GUIDE.md](../RESTORE_DATABASE_GUIDE.md) (if present).

---

## Scenario A — Database corruption / loss

1. **Stop app** — `pm2 stop insight-books` or `docker compose stop app`
2. **Assess** — identify last good backup timestamp (RPO)
3. **Restore DB**
   - Docker: mount dump in `docker-entrypoint-initdb.d` or use `pg_restore`
   - Scripts: `scripts/restore-from-backup.sh`, `scripts/restore-data-from-dump.js`
4. **Migrate** — `npm run db:migrate:deploy` if schema ahead of dump
5. **Verify integrity**
   - `node scripts/verify-accounting-scenario.cjs`
   - Spot-check trial balance via API
6. **Start app** — `pm2 start` / `docker compose up -d`
7. **Health** — `/api/system/ready` (when available)
8. **Record** — restore duration for [RECOVERY_OBJECTIVES.md](./RECOVERY_OBJECTIVES.md)

---

## Scenario B — Application host loss

1. Provision new host (Node 20)
2. Clone repo / deploy artifact
3. Restore or reattach PostgreSQL (Scenario A if DB also lost)
4. Restore `public/uploads` volume from backup
5. Configure `.env` (never commit secrets)
6. `npm run build && pm2 start` per [docs/PRODUCTION_DEPLOYMENT_GUIDE.md](../PRODUCTION_DEPLOYMENT_GUIDE.md)

---

## Scenario C — Bad deploy (code)

Use [ROLLBACK_STRATEGY.md](./ROLLBACK_STRATEGY.md) — not full DR.

---

## Post-restore checks

| Check | Command / route |
|---|---|
| DB connectivity | `/api/system/ready` |
| Login | Manual smoke |
| TB totals | Compare to pre-incident export if available |
| Outbox backlog | ARCH-005 audit |

---

## Communication template

- Incident start time (UTC)
- RPO of backup used
- Estimated RTO
- User-facing status channel

---

## Cross-links

- [RECOVERY_OBJECTIVES.md](./RECOVERY_OBJECTIVES.md)
- [OPERATIONAL_RUNBOOKS.md](./OPERATIONAL_RUNBOOKS.md)
