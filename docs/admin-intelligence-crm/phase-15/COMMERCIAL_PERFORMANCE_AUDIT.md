# Commercial Performance Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Commercial list pagination/filter/sort server-side | NOT_FOUND | Design API sketch |
| Pricing calculation idempotency / caching | NOT_FOUND | Wave 2 |
| PDF render job queue | NOT_FOUND | Wave 3 — PERFORMANCE_RISK if sync-only at scale |
| Pipeline report take:5000 pattern | PERFORMANCE_RISK | Avoid unbounded commercial report scans |
| Prisma EPERM Windows | CARRY | SQL fallbacks + hasCrm*Model guards |

**Implication:** Paginate commercial hubs; async render for heavy PDFs; guard model availability.
