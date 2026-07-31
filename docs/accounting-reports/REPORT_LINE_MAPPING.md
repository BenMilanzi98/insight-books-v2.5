# Report Line Mapping

Every ACCOUNT_GROUP line carries a declarative `match` rule evaluated by
`accountMatchesRule(profile, rule)` against the account's resolved profile
(`resolveAccountProfile`):

## Profile inputs (precedence order)

1. **Explicit Phase 3 classification** — `coaV2Category`, `coaV2SubType`,
   `financialStatementSection/Subsection`, `cashFlowClassification`,
   `systemPurpose`, `controlAccountPurpose` (exposed through the ledger query
   service's account select).
2. **Legacy account type** — mapped to a category when CoA V2 classification
   is absent (`asset → ASSET`, `income → REVENUE`, …).
3. **Assist heuristics** — name/code fragments (cash/bank, receivable,
   payable, inventory, fixed asset, depreciation, interest, tax, loan,
   payroll, capital, drawings, retained earnings, prepayment, salaries).
   Assists apply **only when no explicit sub-classification exists** and every
   assisted assignment emits a `MAPPING_ASSISTED` warning on the envelope.

Account-code ranges are never used as the mapping mechanism.

## Rule vocabulary

`categories`, `subTypes`, `purposes` (system or control purpose), `sections`
(financial-statement section/subsection), `assistAny`, `excludeSubTypes`,
`excludeAssist`, `isCash`. Rules are data, not code.

## Determinism and single assignment

`assignAccountsToLines(definition, accountRows, inScope)`:

- evaluates lines in definition order, **first match wins** — one account
  contributes to exactly one ACCOUNT_GROUP line (REP-013/REP-037 impossible by
  construction, plus a runtime duplicate check in `validateEnvelope`);
- skips header accounts (presentation-only; direct header activity is flagged
  GL-110 upstream);
- receives rows already merged-alias rolled-up by the ledger service, so
  aliases cannot duplicate activity;
- returns `unmapped` accounts (in-scope but matching no line) and `assisted`
  assignments for disclosure.

Every populated line exposes `accountIds`, `accountCodes`, `accountNames` and
per-account amounts — every report line displays its source account codes and
names (tested).

Unmapped material balances are disclosed as REP-036 warnings and block
VERIFIED (see REPORT_VALIDATION_RULES.md); they are never silently excluded.
