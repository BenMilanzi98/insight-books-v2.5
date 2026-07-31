# Component Reuse Matrix

| Component / module | Classification | Phase 2 action |
|--------------------|----------------|----------------|
| AdminShell | `EXTEND` | Alias `AdminAppShell`; add footer, language, notification slots |
| AdminSidebar | `EXTEND` | i18n labels via nav keys; ensure COA absent |
| AdminHeader | `EXTEND` | Breadcrumbs, lang switcher, notification trigger, user menu |
| AdminGlobalSearch | `EXTEND` | i18n; assert COA never indexed |
| AdminSupportAccessBanner | `KEEP_AS_IS` | Optional i18n strings |
| AdminNoticeBanner | `KEEP_AS_IS` | Optional i18n |
| AdminPageHeader / Container / Enter | `REUSE` | i18n-ready title props |
| AdminDataTable | `STANDARDISE` | Document mobile card mode; a11y pass |
| AdminFilterBar | `EXTEND` | Compose with date-range |
| AdminField | `REUSE` | |
| AdminModal / Drawer / ConfirmationDialog | `REUSE` | a11y focus traps already partial — verify |
| AdminLoading / Empty / Error | `EXTEND` | Translation keys |
| AdminStatusBadge / SummaryCard | `REUSE` | SummaryCard: no implied “revenue” semantics |
| AdminChartCard / Pie / Trend / Bar | `REUSE` | Sample fixtures only in Story/tests — not production fake KPIs |
| AdminActionMenu | `KEEP_AS_IS` | |
| AdminMraEisSectionNav | `KEEP_AS_IS` | Domain-specific — out of generic kit expansion |
| Sidebar.js masterAdmin | `DEPRECATE` | Not control-plane chrome; document stop-use |
| Tenant Sidebar / AppShell | `NOT_APPLICABLE` | Tenant plane |

## New components to add (foundation only)

| Component | Purpose |
|-----------|---------|
| `AdminBreadcrumbs` | Canonical crumbs from adminNav |
| `AdminDateRangePicker` | Shared date range control |
| `AdminTabs` / `AdminAccordion` | Primitives |
| `AdminNotificationCentre` | UI foundation (empty state — no fake alerts) |
| `AdminExportDialog` / `AdminImportDialog` | Shell dialogs |
| `AdminMoney` | Amount + currency + optional `sourceContext` prop (required for money) |
| `AdminPermissionGate` | Client hide/disable only |
| `AdminScopeBadge` | Display scope tag |
| `AdminFooter` | Version / build region |
