# Equity Reporting

Two surfaces, one source:

1. **EQUITY module report** — `generateModuleReport(..., 'EQUITY')`,
   credit-normal: every equity GL account with opening, movement and closing
   from canonical journal lines. Fixture: capital 1,000,000 − drawings 8,000 →
   992,000 (posted equity accounts; current-year profit is reported through
   the statements, not duplicated here).
2. **Statement of Changes in Equity** — see
   STATEMENT_OF_CHANGES_IN_EQUITY.md; reconciles to Balance Sheet equity
   (REP-005).

Guarantees:

- Every figure derives from equity Journal Entry Lines; source capital
  transactions are never summed in addition to journals.
- The repaired MK1,000,000 owner-capital event appears exactly once — the
  legacy mirror journal is excluded by the canonical authority rules, asserted
  in the Trial Balance, Balance Sheet, equity statement and module report
  tests.
- Access requires `reports.viewEquity` or `capital.view` — capital/equity
  detail is not exposed through generic report access
  (`reportPermissions.js`).

Owner statements, dividends declarations and share-capital workflows belong to
the Equity Management module (later phase); their postings will flow through
the Phase 4 posting engine and appear here automatically.
