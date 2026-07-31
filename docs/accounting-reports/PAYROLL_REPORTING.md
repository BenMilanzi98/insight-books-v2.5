# Payroll Reporting

`generateModuleReport(db, ctx, request, 'PAYROLL')`.

Covers salaries/wages expense (explicit `coaV2SubType = 'SALARIES'` — Account
**5200** is the canonical Salaries & Wages account and appears in the fixture
tests) plus payroll liabilities (PAYROLL_LIABILITY, PENSION_PAYABLE sub-types;
PAYROLL_PAYABLE / PENSION_PAYABLE / PAYE_PAYABLE purposes; name assists for
legacy accounts such as "salaries payable").

Each line reports opening, period movement and closing from canonical journal
lines. Payroll operational records (employee-level detail, PAYE, pension,
deductions) remain the payroll module's screens; financial totals must
reconcile to the GL accounts on this report, and differences surface as
REP-010 findings.

Access is restricted: the PAYROLL report type requires the dedicated
`reports.viewPayroll` permission and is **not** granted through the generic
`reports.view` (see `reportPermissions.js`) — payroll amounts never leak
through general report access.
