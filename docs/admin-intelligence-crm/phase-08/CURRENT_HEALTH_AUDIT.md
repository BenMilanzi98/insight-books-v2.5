# Current Health Audit

**Finding:** No Customer Health product exists. Phase 7 explicitly forbids opaque health scores.

| Check | Result | Evidence |
|-------|--------|----------|
| Health routes under `/insightbooks/intelligence/customer-health` | NOT_FOUND | No `app/insightbooks/intelligence/customer-health` pages |
| Health APIs | NOT_FOUND | No `app/api/admin/intelligence/customer-health` |
| Health lib | NOT_FOUND | No `lib/admin/health/` |
| Prisma HealthDefinition / HealthSnapshot | NOT_FOUND | Grep `schema.prisma` — absent |
| Permissions `intel.customerHealth.*` | NOT_FOUND | `lib/admin/permissions.js` has `intel.customers.*` only |
| Signal catalogue HEALTH_SCORE | FORBIDDEN listed | `SIGNAL_NOT_SUPPORTED` includes `HEALTH_SCORE`, `CHURN_PROBABILITY` |
| Phase 7 gap G10 | Open for P8 | Opaque health temptation documented as High |

**Implication:** Wave 1 must introduce governed, versioned health from scratch. Do not repurpose Phase 7 signals as a score.
