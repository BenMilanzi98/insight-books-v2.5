# Customer Health Security Audit

| Control | Current | Required |
|---------|---------|----------|
| Permission gate | N/A (no surface) | `intel.customerHealth.read` / manage / rebuild |
| Portfolio scope | Phase 7 pattern exists | Reuse `assertTenantInPortfolio` / portfolioScope on every tenant health read |
| Cross-tenant list | N/A | Filter by portfolio membership for agents |
| Mutation of billing/sub via health | N/A | Health is read/evaluate/snapshot only |
| Audit log | Admin decision pattern | Log definition changes + rebuilds |
| PII in export | Customer export exists | Health export: tenant id/name + scores/drivers; no password hashes |

**Threat:** Agents inferring out-of-portfolio tenants via health distribution endpoints — mitigate with scoped aggregations only.
