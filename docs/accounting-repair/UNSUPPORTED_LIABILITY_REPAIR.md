# Unsupported Liability Repair

Liabilities visible in the Chart of Accounts or reports but not supported by
journal evidence.

## Investigation per liability

Identify: account, amount, the report surfacing it, the query source (stored
balance? opening field? operational aggregation — supplier/loan/payroll/tax
tables? hidden journal status? wrong period/business filter? soft-deleted
journal? projection row? alias/hierarchy duplication? journal in a sibling
liability account?), the operational counterpart (creditor, lender, employee,
tax authority, supplier), period, business, and available evidence.

The capital trace script covers liability accounts too: stored balance vs
legacy lines vs V2 lines vs canonical GL, per account.

## Decision table (enforced by permitted repairs on `UNSUPPORTED_LIABILITY`)

| Evidence | Treatment | Journal? |
|---|---|---|
| Journals exist; report hides them (filter/join/status defect) | `REPORT_ONLY_REPAIR` | No |
| Stored balance duplicates journals | Canonical reporting excludes the stored field; keep as legacy metadata | No |
| Authoritative source proves a real missing liability (signed loan contract, payroll run, tax assessment, supplier bill) | Approved `MISSING_JOURNAL_REPAIR` | Yes |
| No reliable evidence either way | **Exception** — `ACCEPTED_TEMPORARILY`/`AWAITING_DOCUMENTS`, disclosed to Phase 7; excluded from authoritative reporting only once proven to come from a non-authoritative cache/field | Never |

Inventing a correcting journal for an unevidenced liability is blocked twice:
the confidence gate (UNSUPPORTED cannot be approved) and the permitted-repairs
list. 

## Dev-dataset result

The forensic trace across all tenants found **no unsupported liability**:
liability stored balances reconcile to journal support in the current data. The
detection and repair paths remain in place for production datasets.
