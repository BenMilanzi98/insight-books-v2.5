# Account Hierarchy Reporting

## Rules

- **Posting accounts** carry balances; **header accounts**
  (`coaV2Behaviour = 'HEADER'` or `postingAllowed = false`) are
  presentation-only.
- Parent-derived totals are computed by aggregation
  (`getLedgerHierarchy` marks them `rollup.presentationOnly: true`) and are
  **never added again** to child totals.
- Direct activity posted to a header account is separately identified as a
  GL-110 anomaly and surfaced on the Trial Balance as a warning — never
  silently merged into children.
- Deprecated historical children remain reportable
  (`includeDeprecatedAccounts` defaults to true).
- Canonical aliases (merged accounts) roll up to their survivor exactly once
  via `buildSurvivorResolver`; the original posting account is preserved on
  each drill-down line (`postingAccountId`, `rolledUpFromMergedAccount`).
- One journal entry line contributes once to a report: statement mapping is
  single-assignment (first match wins) and headers are excluded from amounts.
- An account cannot appear in two incompatible sections: the definition
  evaluates in order with exclusion rules, and `validateEnvelope` raises
  REP-013 if any account id appears on two ACCOUNT_GROUP lines.

## Tests proving no double counting

- Trial Balance: header account shows zero own amounts while children carry
  the activity.
- Balance Sheet: no P&L account id appears on any position ACCOUNT_GROUP
  line; Current Year Earnings exists on exactly one calculated line.
- Owner capital fixture: the MK1,000,000 event with a legacy mirror journal
  reports exactly MK1,000,000.
- `validateEnvelope` REP-013 unit test: the same account on two group lines is
  flagged.
