# Rollback Strategy

Rollback procedures when performance or reliability regressions ship.

---

## Application rollback

| Step | Action |
|---|---|
| 1 | `git checkout` previous tag / PM2 deploy prior build |
| 2 | `npm run build` if needed |
| 3 | `pm2 restart insight-books` — [docs/QUICK_DEPLOYMENT_REFERENCE.md](../QUICK_DEPLOYMENT_REFERENCE.md) |
| 4 | Verify `/api/system/ready` |

Docker: redeploy previous image tag.

---

## Database rollback

**Avoid** rolling back schema after financial posts in production.

| Situation | Action |
|---|---|
| Migration failed mid-deploy | Fix-forward migration preferred |
| Bad migration before posts | Restore backup to staging first, then prod if no posts |

See [DISASTER_RECOVERY_RUNBOOK.md](./DISASTER_RECOVERY_RUNBOOK.md).

---

## Feature flags

Prefer toggling flags in `lib/accountingV2/infrastructure/featureFlags.js` before full rollback when perf regression is flag-gated.

---

## Triggers

- SEV-1 alert ([ALERTING.md](./ALERTING.md))
- Error budget exhausted ([ERROR_BUDGET_POLICY.md](./ERROR_BUDGET_POLICY.md))
- G-Perf-1 failure on release candidate

---

## Cross-links

- [accounting-reports/ROLLBACK_STRATEGY.md](../accounting-reports/ROLLBACK_STRATEGY.md) — report-specific
- [security-governance/ROLLBACK_STRATEGY.md](../security-governance/ROLLBACK_STRATEGY.md)
