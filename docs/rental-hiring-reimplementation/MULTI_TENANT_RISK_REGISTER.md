# Multi-Tenant Risk Register

| ID | Risk | Severity | Evidence | Disposition |
|----|------|----------|----------|-------------|
| T-01 | List/create scoped by tenantId | Low (good) | rentals route | `REUSE` |
| T-02 | rentalItem return loads by id then checks tenant via transaction | OK | return route | `REUSE` |
| T-03 | Availability rows lack tenantId column | Medium | join-only | `EXTEND` denormalise |
| T-04 | Branch optional; project/cost centre absent | Medium | schema | `EXTEND` |
| T-05 | No businessId dimension | Medium | platform pattern | Align with accounting V2 |
| T-06 | Cross-tenant asset book | Mitigated if findFirst tenant | create path | Keep + add tests |
