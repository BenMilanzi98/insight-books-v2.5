# Dimension Repair

Wrong or missing branch, department, project, cost centre, customer, supplier,
employee, owner, bank account, asset, loan, location or tax code.

## Reporting-only dimensions → metadata repair

Permitted (`METADATA_ONLY_REPAIR`) only when ALL hold:

- The rightful dimension is proven (unique reference, source record, audit
  trail).
- The journal's account is correct and amounts are untouched.
- Subledger control is not compromised (the dimension is not what drives a
  control-account balance).
- Audit evidence is complete; previous value preserved; rollback supported.

Whitelisted fields only (e.g. `Transaction.branchId`); the dimension entity must
belong to the same business (cross-business dimension links are refused).

## Subledger-accounting dimensions → journal treatment

Where the dimension IS part of subledger accounting (customer on an AR line,
supplier on an AP line, employee on payroll liabilities, asset/loan links),
metadata edits are not sufficient or safe: use `RECLASSIFICATION_REPAIR` or the
relevant corrective journal treatment so the subledger and control account move
together. Original history is preserved.

`MISSING_CUSTOMER` / `MISSING_SUPPLIER` / `MISSING_EMPLOYEE` / etc. anomaly
types each permit exactly the metadata and/or reclassification classes
appropriate to their control impact (see catalogue).
