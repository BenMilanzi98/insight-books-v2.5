# Product Security Audit

| Control | Current | Required |
|---------|---------|----------|
| Product Analytics permissions | NOT_FOUND | `intel.productAnalytics.*` |
| Portfolio scope on customer product detail | Pattern in Phase 7/8 | Reuse |
| User-level detail permission | NOT_FOUND | Separate from viewOverview |
| Export / schedule permissions | NOT_FOUND | Separate |
| CoA admin route | Removed | Must stay removed |
| Search leakage | — | Do not index user-level broadly |

**Threat:** Feature/module code manipulation, tenantId/userId ORMs, cache keys missing scope/definition version.
