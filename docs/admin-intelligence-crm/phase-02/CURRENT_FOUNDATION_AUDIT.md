# Current Foundation Audit

**Audited:** 2026-07-28

## What exists today

| Layer | Asset | Classification |
|-------|-------|----------------|
| Shell | `components/shell/AdminShell.jsx` | `EXTEND` → rename/alias as AdminAppShell |
| Sidebar | `components/AdminSidebar/AdminSidebar.js` + `lib/admin/adminNav.js` | `KEEP` / `EXTEND` |
| Header | `components/admin/AdminHeader.jsx` | `EXTEND` (breadcrumbs, i18n, notifications) |
| Support banner | `AdminSupportAccessBanner` | `KEEP` |
| Notice banner | `AdminNoticeBanner` | `KEEP` |
| Global search | `AdminGlobalSearch` + `lib/admin/adminSearch.js` | `EXTEND` (exclude COA; i18n) |
| UI kit | `components/admin/*` (table, field, filter, modal, drawer, charts, states) | `REUSE` / `STANDARDISE` |
| Permissions | `lib/admin/permissions.js` | `EXTEND` (map completeness + intel/crm keys) |
| Auth | `lib/adminAuth.js`, layout `/me` gate, middleware cookie | `KEEP` / document weakness |
| i18n runtime | `lib/i18n/*`, `I18nProvider` in RootLayout | `REUSE` — **admin pages not wired** |
| Locale files | `locales/en|ny/administration.json` (minimal) | `EXTEND` |
| Design tokens | CSS vars `--admin-*` in admin shell styles | `EXTEND` / document |
| Tests | `test/systemAdmin*.test.js` | `EXTEND` |

## Missing vs Phase 2 target

| Target | Status |
|--------|--------|
| Breadcrumbs component | NOT_FOUND as shared |
| Language switcher in AdminHeader | NOT_FOUND |
| Notification centre foundation | NOT_FOUND |
| Date-range control | NOT_FOUND as shared |
| Export/import dialog shells | NOT_FOUND as shared |
| Tabs / Accordion primitives | NOT_FOUND in admin kit |
| Amount/Money display with source context | NOT_FOUND |
| AdminPermissionGate component | NOT_FOUND |
| Scope-aware query helpers | NOT_FOUND |
| Canonical admin API client + error envelope | NOT_FOUND (ad-hoc fetch) |
| Correlation ID on admin client | PARTIAL (MRA EIS / accounting patterns exist elsewhere) |
| Feature-flag helper for admin foundation | NOT_FOUND |
| Admin footer / version region | INCOMPLETE |
| Canonical mobile nav named component | Embedded in AdminShell (works) — `STANDARDISE` |

## Do not duplicate

Do **not** create a second table/modal/chart system. Extend `components/admin`.
