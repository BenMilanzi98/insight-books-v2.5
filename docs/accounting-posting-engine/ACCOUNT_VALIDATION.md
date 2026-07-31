# Account Validation

Implementation: `lib/accountingV2/engine/accountValidation.js`
(`validateLineAccount`, `validateDraftAccounts`), executed for **every**
generated journal line inside the validation pipeline.

## Per-line checks

1. Account exists (`AccountNotFoundError`).
2. Account belongs to the command's business (`CrossTenantAccountError`).
3. Account is active (`InactiveAccountError`).
4. Account is not deprecated for new postings (`DeprecatedAccountError`) —
   honours CoA V2 `deprecationState` / `postingAllowed`.
5. Account is not a header/summary account (`NonPostingAccountError`).
6. Account behaviour/category matches the template's required purpose.
7. Currency policy: specific-currency accounts must match the draft currency.
8. Control-account dimensions (`ControlAccountDimensionError`):
   - Accounts Receivable → requires `customerId`.
   - Accounts Payable → requires `supplierId`.
   - Owner capital/drawings → requires owner/shareholder where configured.
   - Bank control accounts → require bank-account dimension where configured.
9. Prohibited dimensions are absent.
10. Manual posting restrictions (`MANUAL_RESTRICTED_PURPOSES`): manual
    journals cannot hit Current Year Earnings, Retained Earnings, or
    system-clearing purposes without elevated permission.
11. Effective dates permit use at the posting date.

`validateDraftAccounts` batch-loads all referenced accounts in one query
(no N+1) and evaluates lines deterministically; in `collect` mode (preview) it
returns all issues, in `strict` mode it throws the first typed error.

Tests: account suite in `test/accountingV2.postingEngine.test.js` — valid
posting account, cross-business, header, deprecated, inactive, missing
customer/supplier dimension, restricted purposes.
