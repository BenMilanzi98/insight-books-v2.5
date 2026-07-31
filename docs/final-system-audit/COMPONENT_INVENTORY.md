# Component Inventory

| Field | Value |
|---|---|
| Generated | 2026-07-23T10:22:17.109Z |
| `components/**/*.{js,jsx,tsx}` | Counted via workspace scan at generation time |

## Notes

- Shared report UI: `components/reports/`, `components/FinancialReportComponents.js`, `components/ExpenseReport.js`, `components/SalesReport.js`.
- Sidebar registers V2 modules in `components/Sidebar/Sidebar.js`.
- CoA presentation tree: `lib/coaSystemStructureTree.js` + rollup `lib/coaChartRollup.js` (not React components, but UI-critical).

## Classification

Most presentational components: **COMPLETE_REQUIRES_TESTING** (responsive + a11y not fully certified).

Interactive financial surfaces that still call legacy report APIs: **DUPLICATED** / **UNSAFE** until wired exclusively to Accounting V2.
