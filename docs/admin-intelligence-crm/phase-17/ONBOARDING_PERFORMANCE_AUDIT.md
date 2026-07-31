# Onboarding Performance Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Onboarding list/detail APIs | NOT_FOUND | No load path yet — design for server pagination from Wave 1 stubs |
| Foundations findMany take 100 | PERFORMANCE_RISK (minor) | `foundations.js` `take: 100` — OK for thin rows; Project lists need cursor/limit |
| Materialisation fan-out (workstreams/milestones/tasks) | PERFORMANCE_RISK | Wave 2 must batch insert + idempotent once — avoid N+1 UI hydration |
| Readiness evaluate multi-dimension | PERFORMANCE_RISK | Wave 3 — cache with watermark/recon version (spec §12) |
| Report aggregates without reliability gate | FORBIDDEN pattern | Gate first; never scan all tenants for fake KPIs |
| Search index ONB/ONR | NOT_FOUND | Wave 4 — exclude migration blobs |
| Prisma EPERM Windows | BLOCKED/CARRY locally | SQL fallbacks + model guards as Phase 16 |

**Disposition:** Thin stubs OK early; Wave 4 cache keys include env/project/tenant/role/permission/watermark; never cache migration files or credentials.
