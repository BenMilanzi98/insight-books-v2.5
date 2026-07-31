# Multi-Tenant Risk Register

| ID | Risk | Evidence | Severity | Classification |
|----|------|----------|----------|----------------|
| MT-01 | Global unique `Employee.employeeId` | schema `@unique` | High | `CROSS_TENANT_RISK` |
| MT-02 | Global unique `Department.name` | schema `@unique` | High | `CROSS_TENANT_RISK` |
| MT-03 | EmployeeBenefit without tenantId | schema | High | `CROSS_TENANT_RISK` |
| MT-04 | GratuityPayment without tenantId | schema | Medium | `CROSS_TENANT_RISK` |
| MT-05 | AdvanceDeduction without tenantId | schema | Medium | `CROSS_TENANT_RISK` |
| MT-06 | Payroll status update by id only | `payroll/[id]/status` | Critical | `CROSS_TENANT_RISK` / `UNSAFE` |
| MT-07 | No branchId on HR entities | schema | Medium | `INCOMPLETE` |
| MT-08 | Manager scope not enforced at repository layer consistently | Coarse permissions | High | `INCOMPLETE` |
| MT-09 | Payslip / export leakage across employees | Needs IDOR tests | High | Security follow-up |
| MT-10 | Cache/search isolation for HR | Not audited in depth | Medium | Verify |

## Mitigations

- All uniques become `@@unique([tenantId, …])`.  
- Child tables carry tenantId + composite FKs.  
- Every mutation: `where: { id, tenantId }`.  
- Branch/department filters in list APIs.
