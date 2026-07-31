# Multi-Tenant Risk Register

**Audited:** 2026-07-28

| ID | Risk | Severity | Evidence / note | Phase 1 status |
|----|------|----------|-----------------|----------------|
| MT-01 | Admin APIs that omit `tenantId` filters when listing TENANT_SCOPED rows | High | Every new intel query must declare scope | Documented; no new APIs |
| MT-02 | Dashboard aggregates across all tenants without labeling “platform rollup” | Medium | `/api/admin/dashboard/stats` rolls up Sales | Flagged UNSAFE metric semantics |
| MT-03 | Support impersonation session leakage into analytics actor identity | High | PlatformSupportAccess | Keep SECURITY_RESTRICTED |
| MT-04 | Cross-tenant joins in future BI SQL without tenant predicate | Critical | Future read models | Architecture rule: always classify scope |
| MT-05 | Affiliate data mixed into tenant financials | Medium | Affiliate models are platform channel | Keep separate |
| MT-06 | Export endpoints streaming raw tenant GL to admins | High | Future reports | Permission + redaction policy required |

## Required classification for every future source

Every proposed metric query must state:

1. Scope tag  
2. Authoritative table(s)  
3. Whether result is rollup vs single-tenant drill-down  
4. Whether PII is included  

Phase 1 creates no new rollup tables.
