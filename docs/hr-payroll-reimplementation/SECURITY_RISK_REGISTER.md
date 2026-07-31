# Security Risk Register

| ID | Risk | Evidence | Severity | Classification |
|----|------|----------|----------|----------------|
| SEC-01 | Arbitrary payroll status mutation | `PATCH /api/payroll/[id]/status` — no permission, no tenant where | Critical | `UNSAFE` |
| SEC-02 | Coarse RBAC vs master permission matrix | Mostly `hr.view` / `payroll.view` | High | `INCOMPLETE` |
| SEC-03 | No SoD between prepare / approve / post / pay | Single role can do all | High | `INCOMPLETE` |
| SEC-04 | Bank details editable without approval workflow | Employee.bankDetails Json | High | `INCOMPLETE` |
| SEC-05 | Manual OT/deduction without source record | Enhanced inputs | High | `UNSAFE` |
| SEC-06 | IDOR on payroll/employee/payslip by id | Pattern risk (status route proves weak pattern) | Critical | Verify all |
| SEC-07 | Payslip email/download permission re-check | Required | Medium | Verify |
| SEC-08 | Import overwrite of approved payroll | Import exists for employees | Medium | Guard |
| SEC-09 | Formula injection if free-text formula added later | N/A today | Block | Design constraint |
| SEC-10 | Auditor write access | Not separated | Medium | `INCOMPLETE` |
| SEC-11 | PAYE Summary nav inconsistency | Static vs filtered menus | Low | UX / access confusion |

## Immediate hardening (Phase 2 Foundation)

1. Delete or rewrite status route to business commands with tenant scope + permission.  
2. Add `where: { id, tenantId }` audit across payroll mutations.  
3. Introduce fine-grained permissions incrementally starting with `payroll.approve`, `payroll.post`, `payroll.pay`, `payroll.reverse`.
