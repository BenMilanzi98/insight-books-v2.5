# Employee Management Audit

Routes: `/hr/employees` · APIs: `app/api/employees/**` · Model: `Employee`

## Findings

### Strengths (`REUSE` / `EXTEND`)

- Large employee UI (~3.7k LOC) covering profile, NPS flags, deductions, benefits, ID card, documents, photo.
- Lifecycle endpoints: terminate, suspend, reactivate.
- Import/export templates and bulk PAYE apply.
- Tenant scoping on primary Employee queries (typical pattern via session `tenantId`).

### Gaps

| Gap | Classification |
|-----|----------------|
| No versioned Employment Contract | `INCOMPLETE` / `REIMPLEMENT` |
| Compensation on Employee as Float (`salary`, `grossSalary`, `hourlyRate`) | `INCORRECT_CALCULATION` |
| Pay basis inferred from fields, not declared enum | `INCOMPLETE` |
| `employeeId` globally `@unique` | `CROSS_TENANT_RISK` |
| Dual department: string + `departmentId` | `REFACTOR` |
| No branch assignment on Employee | `INCOMPLETE` |
| Bank details Json — audit/approval not enforced as workflow | `INCOMPLETE` / `UNSAFE` (if silent edit) |
| Historical immutability when referenced by payroll | `INCOMPLETE` |
| Qualifications / skills / promotions / transfers as first-class history | `INCOMPLETE` |
| Disciplinary history | `INCOMPLETE` |

### Payroll coupling

- `selectedDeductions` Json drives statutory inclusion (PAYE/NPS match by name).  
- Benefits via `EmployeeBenefit` — often added to net after tax by callers (see calculation audit).  
- `employees/calculate-salary` → `calculatePayroll` preview only.

### Disposition

| Surface | Classification |
|---------|----------------|
| Employee CRUD UI/API | `EXTEND` |
| Identity uniqueness | `REFACTOR` → (tenantId, employeeNumber) |
| Compensation | `REIMPLEMENT` via contracts + effective dating |
| Documents/photos | `REUSE` |
