# Statement of Changes in Equity

`generateEquityStatement` in `financialStatementService.js`, definition
`EQ-CHANGES` 1.0.0.

## Structure

Opening Equity → Capital Contributions and Share Issues → Profit / (Loss) for
the Period → Owner Drawings → Retained Earnings Movements (posted) → Other
Equity Movements → Closing Equity.

## Calculation rules

- Uses equity Journal Entry Lines exclusively; source capital transactions are
  never summed in addition to journals.
- Opening equity includes equity account opening balances **plus** accumulated
  prior P&L (so opening equity is complete even before year-end closing
  entries exist).
- Profit for the period is calculated from P&L account movements — the same
  basis as the Income Statement and the Balance Sheet CYE line, so
  current-year profit cannot be duplicated.
- Movements classify by explicit sub-type first (OWNER_CAPITAL, SHARE_CAPITAL,
  CAPITAL_CONTRIBUTION, SHARE_PREMIUM → contributions; DRAWINGS → drawings;
  RETAINED_EARNINGS → posted RE movements; everything else → other), with name
  assists for unclassified legacy equity accounts.
- Component lines carry their source accounts and drill down (basis PERIOD,
  `displaySign: -1`).

## Validation (REP-005)

`runReportReconciliation` requires closing equity per this statement to equal
Balance Sheet total equity exactly. Fixture: opening 0, contributions
1,000,000 (the repaired MK1,000,000 owner-capital event appears once), profit
20,000, drawings −8,000, closing 1,012,000 = Balance Sheet equity — asserted
in tests.

## Related capital and equity reports

The EQUITY module report (`generateModuleReport(..., 'EQUITY')`) provides the
capital-account view (per-account opening/movement/closing over equity GL
accounts). Owner statements, dividends and share-register workflows belong to
the Equity Management module (later phase); their financial totals already
reconcile through this statement.
