# Account Mapping Integration

The engine resolves accounts exclusively through the Phase 3 CoA V2 mapping
layer (`lib/coaV2/` — canonical mappings in `CoaV2AccountMapping`), surfaced
to templates via the account-resolution helpers used in
`lib/accountingV2/templates/pilotTemplates.js`.

## Resolution inputs

Business, event type, system purpose (e.g. `ACCOUNTS_RECEIVABLE`,
`SALES_REVENUE`, `VAT_OUTPUT`, `OPENING_BALANCE_EQUITY`), transaction type,
currency, branch (where configured), effective date, tax code and source
dimensions. Specificity/priority ordering is handled by the Phase 3 resolver;
`*` wildcards match any module/type/currency/branch.

## Rejections

The engine rejects, with typed errors, any resolution that yields:

- No mapping → `MissingAccountMappingError` (integration Scenario 5: posting
  refused, no journal, actionable error naming the missing purpose).
- More than one equally-specific active mapping → `ConflictingAccountMappingError`.
- A cross-business account → `CrossTenantAccountError`.
- Inactive / deprecated / header accounts → respective typed errors
  (re-checked by account validation even after mapping succeeds).
- Accounts outside effective dates, or specific-currency accounts that do not
  match the command currency.
- Control accounts without the required subledger dimension.
- Accounts flagged as prohibiting manual postings (for manual-journal lines).

## Forbidden fallbacks

There is no fallback by account name, first-in-category, lowest code, global
account or hardcoded ID. No automatic suspense account exists; an unbalanced
or unmappable draft is rejected outright (`UnbalancedJournalError` /
`MissingAccountMappingError`). A suspense policy, if ever approved, would be a
new explicit template — none is implemented in Phase 4.

Salary postings resolve through the approved `SALARIES_WAGES` mapping (Account
5200 convention from Phase 3) — declared in the `PAYROLL_RUN` template
definition for Phase 9 activation.
