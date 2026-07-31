# Multi-Tenant Audit — System Audit

| Status | **STUB — automated tests exist; prod audit PENDING** |

## Isolation mechanisms

- `tenantId` / `businessId` on operational and V2 accounting tables
- Posting engine strict tenant validation (flag-gated)
- Query scoping in API middleware patterns

## Automated tests

| Suite | Focus |
|---|---|
| `test/tenantScope.test.js` | Tenant scope helpers |
| `test/qa/multi-tenant/isolation.matrix.test.js` | Cross-tenant matrix |
| REG-TEN-POST-001 | V2 journal line tenant enforcement |
| REG-XTEN-001 | Cross-tenant line detection (repair domain) |

## Known structural risks

- Nullable `Account.tenantId` (global template rows) — COA-012
- SEC-1 / SEC-2 legacy holes — see Phase 1 security audit

## TO FILL

- Production sample: cross-tenant query attempts on staging
- Tenant count / largest tenant profiling for Phase 17

## Related

`docs/accounting-audit/MULTI_TENANT_AND_SECURITY_AUDIT.md`
