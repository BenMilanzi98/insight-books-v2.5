# Phase 2 Implementation Plan

**Status:** Locked decisions — awaiting formal design approval  
**Strategy:** Approach **A** (extend-in-place) + **`migrate-pages`**  
**Design spec:** [`docs/superpowers/specs/2026-07-28-admin-platform-foundation-phase-02-design.md`](../../superpowers/specs/2026-07-28-admin-platform-foundation-phase-02-design.md)

## Locked approach

**A — Extend-in-place** + migrate maintained `/insightbooks` pages onto foundation (adminApi, page chrome i18n, kit, gates).

- Alias `AdminAppShell` = current `AdminShell`
- Fill gaps (i18n, breadcrumbs, date-range, notifications UI, adminApi, permission map, money, gates)
- Migrate maintained pages (see design §4) — not redirect stubs
- Deprecate Sidebar masterAdmin as control-plane nav
- No greenfield shell rewrite

## Workstreams (ordered)

### WS0 — Safety rails (tests first)

1. Extend COA removal tests (search, breadcrumbs once added, mobile nav labels)
2. Test: every `adminNav` href ∈ `NAV_PERMISSION_MAP`
3. i18n catalogue parity harness for new namespaces

### WS1 — Tokens + lib foundations

1. Centralise `styles/admin-tokens.css` (or document existing)
2. `lib/admin/correlation.js`
3. `lib/admin/apiEnvelope.js` + `lib/admin/adminApi.js`
4. `lib/admin/queryState.js`
5. `lib/admin/scopes.js` (enum constants)
6. `lib/admin/featureFlags.js` (foundation flags only)
7. Permission map completion + `intel.*` / `crm.*` key scaffolding

### WS2 — i18n namespaces

1. `locales/en|ny/admin-shell.json`
2. `locales/en|ny/admin-foundation.json`
3. Nav `labelKey` on `ADMIN_NAV_SECTIONS`
4. Wire shell/header/sidebar/states

### WS3 — Shell chrome

1. `AdminBreadcrumbs`
2. Language switcher in header (uses existing locale cookie/API)
3. `AdminNotificationCentre` foundation (empty — no fake alerts)
4. `AdminFooter`
5. Actor strip (admin identity + support-access already; clarify labels via i18n)

### WS4 — Shared primitives

1. `AdminDateRangePicker`
2. `AdminTabs` / `AdminAccordion`
3. `AdminExportDialog` / `AdminImportDialog` shells
4. `AdminMoney` (currency + amount + required `sourceContext`)
5. `AdminPermissionGate` / `AdminScopeBadge`
6. a11y pass on Modal/Drawer/Table

### WS4 — Page migration (migrate-pages)

Order: dashboard → tenants/users → billing → mra-eis → email → affiliate → security/audit/health → settings/mobile/reports/imports → login chrome.

Per page bar: `adminApi` + chrome/actions/states/column headers i18n + kit + permission gates. No business-logic changes.

### WS5 — Integration + regression

1. Export barrel updates `components/admin/index.js`
2. Layout uses AdminAppShell alias
3. Run vitest systemAdmin + new foundation suites
4. Update `phase-02/README.md` status to complete when gates pass

## Explicit non-work

- No MRR cards, CRM routes, fake KPIs
- No billing callback changes
- No System CoA UI

## Approval gate

Reply **`approve phase-2 design`** on the design spec before code starts.
