# Benefits & Allowances Audit

Routes: `/hr/benefits` · APIs: `/api/benefits/**`, `/api/employees/[id]/benefits` · Models: Benefit, EmployeeBenefit

## Findings

| Topic | Status | Classification |
|-------|--------|----------------|
| Catalogue CRUD | Present (name, default amount/percentage) | `EXTEND` |
| Taxable / non-taxable flags | Absent | `INCOMPLETE` |
| Pensionable flag | Absent | `INCOMPLETE` |
| Cash vs non-cash | Absent | `INCOMPLETE` |
| Effective dating / caps / eligibility | Absent | `INCOMPLETE` |
| Grade/department assignment | Absent | `INCOMPLETE` |
| Account mapping per benefit | Absent (global payroll mappings only) | `INCOMPLETE` |
| EmployeeBenefit.tenantId | Missing | `CROSS_TENANT_RISK` |
| Payroll line components | Not stored; often added to net after tax | `DISCONNECTED` |
| Separate Allowance catalogue | Collapsed into Benefit | `CONSOLIDATE` naming |

## Disposition

`EXTEND` schema + catalogue; payroll integration `REIMPLEMENT` as versioned components.
