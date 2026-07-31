# Component Inventory

**Date:** 2026-07-25

## Shared / shell

| Component | Path | Class |
|-----------|------|-------|
| Root shell | `app/RootLayoutClient.js` | REFACTOR |
| Sidebar | `components/Sidebar/Sidebar.js` | EXTEND |
| AppBar | `components/AppBar.js` | EXTEND |
| Footer | `components/Footer.js` | KEEP |
| AdminSidebar | `components/AdminSidebar/AdminSidebar.js` | EXTEND |
| AdminAppBar | `components/AdminAppBar.js` | STANDARDISE |
| Legacy AdminSidebar | `components/AdminSidebar.js` | DUPLICATED |
| PermissionGuard | `components/PermissionGuard.js` | KEEP |
| OnboardingGate | `components/OnboardingGate.jsx` | KEEP |
| MetricCard | `components/dashboard/MetricCard.js` | REUSE |
| ui/tabs | `components/ui/tabs.js` | REUSE |
| QuickActions | `components/ui/QuickActions.jsx` | REUSE |
| wizardUi | `components/setup/wizardUi.jsx` | REUSE |
| BfShell | `components/budget-forecast/BfShell.js` | REUSE |

## Feature folders (module-local)

`AdminSidebar`, `auth`, `budget-forecast`, `chart-of-accounts`, `charts`, `Clients`, `dashboard`, `Expenses`, `hr`, `payments`, `pos`, `purchases`, `reports`, `Sales`, `setup`, `Sidebar`, `Stock`, `tax`, `TransactionReversal`, `ui`, `UnitManagement`

## Duplicate families

- **Modals:** 26 `*Modal*` under `components/` — REIMPLEMENT shared Dialog chrome
- **Date range:** `DateRangePicker`, `DateRangeSelector`, `UniversalDateRangeFilter`, `ReportDateRangeModals` — CONSOLIDATE
- **Email composers:** 4+ variants — CONSOLIDATE later wave
- **Status badges:** CSS + BfShell + ReversalStatusBadge + inline — STANDARDISE
- **Tables:** CSS `.data-table` + report tables + page-local — STANDARDISE
