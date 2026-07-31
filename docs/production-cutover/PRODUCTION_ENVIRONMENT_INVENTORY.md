# Production Environment Inventory

**Production facts from this workspace: UNKNOWN (no production SSH from developer workspace).** Do not treat placeholder rows as live values.

| Field | Value |
|---|---|
| Phase | 18 — Production cutover |
| Document status | **TEMPLATE** |
| Cutover execution | **NOT EXECUTED** |
| Branch | `v2` |
| Latest Prisma migration | `20260721200000_security_governance_v2` (~109 folders) |
| Last updated | July 2026 |

---

## TO FILL FROM PRODUCTION

### Host & network

| Field | Value |
|---|---|
| Production hostname(s) | _PENDING_ |
| Public URL | _PENDING_ |
| SSH / bastion access | _PENDING_ |
| Load balancer | _PENDING_ |
| TLS certificate issuer / expiry | _PENDING_ |

### Application runtime

| Field | Value |
|---|---|
| PM2 process name | `insight-books` (documented — **verify on server**) |
| Node.js version | _PENDING_ |
| App working directory | _PENDING_ |
| Git branch deployed | _PENDING_ (target: `v2`) |
| Git commit at cutover | _PENDING_ |

### Database

| Field | Value |
|---|---|
| PostgreSQL version | _PENDING_ |
| Host / port / database name | _PENDING_ |
| Prisma migration head applied | _PENDING_ (workspace target: `20260721200000_security_governance_v2`) |
| Migration folder count | _PENDING_ (workspace: ~109) |
| Replication / HA | _PENDING_ |

### Storage, cron, observability

| Area | Value |
|---|---|
| Upload / attachment root | _PENDING_ |
| Backup storage | _PENDING_ |
| CRON / scheduled jobs | _PENDING_ |
| Health endpoints | Verify `/api/system/health`, `/ready`, `/live` on prod |

---

## Known from workspace only (non-production)

| Item | Value |
|---|---|
| Deploy scripts | `deploy.sh`, `deploy-to-production.sh`, `scripts/safe-deploy-production.sh` |
| Backup script | `scripts/backup-database.sh` |
| Docker compose template | `docker-compose.prod.yml` (verify if used) |
| Developer branch | `v2` |

---

## Verification checklist

- [ ] Production access confirmed (ops / SSH)
- [ ] Read-only inventory captured
- [ ] Secrets redacted from exports
- [ ] Cross-checked with `PRODUCTION_DEPENDENCY_MAP.md`
