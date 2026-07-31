# Training Security Audit

**Audited:** 2026-07-31

| Control | Current | Class | Wave |
|---------|---------|-------|------|
| `systemAdmin.customerSuccess.training*` permission set | Only `customerSuccess.read` on foundations page | NOT_FOUND / EXTEND | 1–4 |
| SoD curriculum author≠approver; attendance correct≠approve; grader≠regrade; cert issue≠revoke | Absent | NOT_FOUND | 2–4 |
| Idempotency exact retry | Handoff emit yes; Request/Program no | EXTEND | 1+ |
| Cross-Tenant denial on Program | Absent | CROSS_TENANT_RISK | 1 |
| `resolveCrmScope` stub mode:all | Present | CROSS_TENANT_RISK / CARRY | Harden |
| Private materials download authz | Absent | FILE_SECURITY_RISK | 2 |
| Assessment answer confidentiality | Absent | ASSESSMENT_TRUTH_RISK | 3 |
| Public cert verify limited fields | Absent | CERTIFICATE_TRUTH_RISK | 3 |
| No Tenant GL / Subscription mutations | Boundary exists elsewhere | CORRECT_AND_REUSABLE / FORBIDDEN from Training | All |
| Model guards `hasCustomerTraining*` | Absent | EXTEND (Prisma EPERM CARRY) | 1 |

**Disposition:** Permissions skeleton Wave 1; SoD deepen Waves 2–4; fail-closed Cross-Tenant; SQL + model guards for Windows EPERM.
