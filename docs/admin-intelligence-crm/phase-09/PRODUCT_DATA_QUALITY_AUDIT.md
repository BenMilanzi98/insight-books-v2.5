# Product Data Quality Audit

| Rule area | Current risk | Phase 9 treatment |
|-----------|--------------|-------------------|
| Unknown feature codes | High — free-form entitlements | Governed catalogue + DQ incident |
| FEATURE_USED absent | Critical for adoption metrics | Gate → NOT_INSTRUMENTED (not zero) |
| Browser as authoritative | High temptation | Forbidden |
| Retry as new usage (EIS) | High | Exclusion rules at producer |
| Reprint as new usage | Medium | Exclusion rules |
| Worker as human usage | Medium | Channel BACKGROUND_SYSTEM excluded from human DAU |
| Cross-tenant event | Critical | Tenant FK + authz tests |

**Gate:** Critical DQ / missing instrumentation blocks metric AVAILABILITY.
