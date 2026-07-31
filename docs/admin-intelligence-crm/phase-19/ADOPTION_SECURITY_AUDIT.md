# Adoption Security Audit

**Audited:** 2026-07-31

| Control | Current | Class | Wave |
|---------|---------|-------|------|
| CS Adoption route permissions | Absent | NOT_FOUND | 1–4 |
| Reuse `customerSuccess.read` / `manageCases` / `manageRenewals` | Present in CS authz | EXTEND | 1 |
| SoD: template author ≠ approver; critical waiver ≠ sole attestor; expansion creator ≠ renewals ACK | Absent | NOT_FOUND | 2–4 |
| Idempotency exact retry | Absent for Adoption | NOT_FOUND | 1+ |
| Cross-Tenant denial on Plan load | Absent | CROSS_TENANT_RISK | 1 |
| Portfolio empty → `[]` | Pattern in Training/CS | CORRECT_AND_REUSABLE | 1 |
| `resolveCrmScope` stub mode:all | Present | CROSS_TENANT_RISK / CARRY | Harden |
| No Tenant GL / Subscription mutations | Boundary exists | FORBIDDEN from Adoption | All |
| Model guards `hasCustomerAdoption*` | Absent | EXTEND (Prisma EPERM CARRY) | 1 |
| Intervention creation only via Phase 8 | Present services | CORRECT_AND_REUSABLE | 3 |

**Disposition:** Permissions + planAccess Wave 1; SoD deepen Waves 2–4; SQL + model guards for Windows EPERM.
