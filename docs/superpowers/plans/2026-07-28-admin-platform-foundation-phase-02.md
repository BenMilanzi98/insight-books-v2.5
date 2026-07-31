# Admin Platform Foundation Phase 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one extend-in-place AdminAppShell foundation (i18n, permissions map, adminApi, shared kit gaps) and migrate maintained `/insightbooks` pages onto it without billing/accounting/CRM feature work.

**Architecture:** Alias `AdminAppShell` → existing `AdminShell`; extend `components/admin` + `lib/admin/*`; register `admin-shell` / `admin-foundation` / `admin-pages` locales; page waves replace raw `fetch` with `adminApi` and chrome strings with `t()`.

**Tech Stack:** Next.js App Router, React 19, Vitest, existing `lib/i18n`, Tailwind admin tokens, Recharts (unchanged).

## Global Constraints

- Approach A + migrate-pages per approved design `docs/superpowers/specs/2026-07-28-admin-platform-foundation-phase-02-design.md`
- Zero System CoA reintroduction; zero Tenant Sale as SaaS revenue UI helpers
- Zero billing callback / accounting logic changes
- No hardcoded user-visible English in new foundation code
- Server authz remains authoritative; client gates are UX only
- Do not commit `.env`
- Commits only when user asks

---

### Task 1: Nav permission map completeness + tests

**Files:**
- Modify: `lib/admin/permissions.js` (`NAV_PERMISSION_MAP`)
- Create: `test/systemAdmin.navPermissionMap.test.js`
- Modify: `lib/admin/adminNav.js` (add helper `listAdminNavHrefs()`)

**Interfaces:**
- Produces: `listAdminNavHrefs(): string[]`, complete `NAV_PERMISSION_MAP`

- [ ] **Step 1: Write failing test** — every href from `listAdminNavHrefs()` has `NAV_PERMISSION_MAP[href]`
- [ ] **Step 2: Run** `npx vitest run test/systemAdmin.navPermissionMap.test.js` — expect FAIL
- [ ] **Step 3: Implement** `listAdminNavHrefs` + map entries for billing children (`overview`, `plans`, `subscriptions`, `invoices`, `payments`, `credits`, `reconciliation`)
- [ ] **Step 4: Run test** — PASS
- [ ] **Step 5: Extend COA tests** — `lib/admin/adminSearch.js` must not return CoA; add assertion in `test/systemAdmin.coaRouteRemoval.test.js`

---

### Task 2: Correlation + apiEnvelope + adminApi

**Files:**
- Create: `lib/admin/correlation.js`, `lib/admin/apiEnvelope.js`, `lib/admin/adminApi.js`, `lib/admin/scopes.js`, `lib/admin/featureFlags.js`
- Create: `test/systemAdmin.adminApi.test.js`

**Interfaces:**
- `createCorrelationId(): string`
- `adminApi(path, { method, body, headers, correlationId, idempotencyKey })` → `{ ok, data, meta, error }` or throws `AdminApiError`
- `ADMIN_SCOPES` frozen object
- `isAdminFoundationFlagEnabled(flag, env)`

- [ ] **Step 1: Failing tests** for correlation header, legacy JSON wrap, envelope parse, 403 → AdminApiError
- [ ] **Step 2: Implement modules**
- [ ] **Step 3: Tests PASS**

---

### Task 3: i18n namespaces

**Files:**
- Create: `locales/en/admin-shell.json`, `locales/ny/admin-shell.json`, `locales/en/admin-foundation.json`, `locales/ny/admin-foundation.json`, `locales/en/admin-pages.json`, `locales/ny/admin-pages.json`
- Modify: `lib/i18n/loadMessages.js` — register namespaces
- Extend: existing i18n parity tests or add `test/i18n.adminFoundation.test.js`

- [ ] **Step 1: Add JSON files** with shell/nav/foundation keys (en + ny)
- [ ] **Step 2: Register in loadMessages**
- [ ] **Step 3: Parity test PASS**

---

### Task 4: adminNav labelKeys + Sidebar/Header i18n

**Files:**
- Modify: `lib/admin/adminNav.js` — `labelKey` / `textKey` on sections/items
- Modify: `components/AdminSidebar/AdminSidebar.js`
- Modify: `components/admin/AdminHeader.jsx`
- Modify: `components/shell/AdminShell.jsx` — export `AdminAppShell` alias; footer slot; wire language/notifications

- [ ] **Step 1: Add labelKeys** matching `admin-shell.nav.*`
- [ ] **Step 2: Sidebar/Header use `useI18n().t`**
- [ ] **Step 3: Shell aria-labels via t()**
- [ ] **Step 4: Run COA + shell nav tests**

---

### Task 5: New chrome components

**Files:**
- Create: `components/admin/AdminBreadcrumbs.jsx`, `AdminLanguageSwitcher.jsx`, `AdminNotificationCentre.jsx`, `AdminFooter.jsx`, `AdminContextBanner.jsx`
- Modify: `components/admin/index.js`, `AdminHeader.jsx`, `AdminShell.jsx`
- Create: `test/systemAdmin.breadcrumbs.test.js` (no CoA crumb)

- [ ] Implement components with i18n + a11y
- [ ] Wire into header/shell
- [ ] Tests PASS

---

### Task 6: Shared primitives

**Files:**
- Create: `AdminDateRangePicker.jsx`, `AdminTabs.jsx`, `AdminAccordion.jsx`, `AdminExportDialog.jsx`, `AdminImportDialog.jsx`, `AdminMoney.jsx`, `AdminPermissionGate.jsx`, `AdminScopeBadge.jsx`
- Create: `test/systemAdmin.adminMoney.test.js`, `test/systemAdmin.permissionGate.test.js`
- Modify: `components/admin/index.js`
- Optional: `styles/admin-tokens.css` + import from admin layout/globals

- [ ] AdminMoney requires `sourceContext` (throw/dev warn if missing)
- [ ] PermissionGate hides/disables without permission
- [ ] Export barrel updated

---

### Task 7: Page migration waves

**Files:** maintained pages under `app/insightbooks/**/page.js` (exclude redirect stubs)

Order: dashboard → tenant-management → user-management → billing/* → mra-eis/* → email → affiliate → audit/security/health → settings/mobile/reports/imports → login

Per page:
- Replace primary `fetch` with `adminApi`
- Page header/actions/empty/error via `t('admin-pages.…')`
- Use kit components; `AdminPermissionGate` on privileged actions
- No business-logic changes

- [ ] Wave complete when vitest foundation suites still pass and pages compile

---

### Task 8: Completion docs

**Files:**
- Modify: `docs/admin-intelligence-crm/phase-02/README.md` status
- Modify: design spec status → Approved / Implemented

- [ ] Record residual untranslated strings if any
- [ ] List deferred non-foundation blockers unchanged

---

## Spec coverage checklist

| Spec section | Task |
|--------------|------|
| AdminAppShell alias | 4 |
| Nav + permission map | 1, 4 |
| i18n namespaces | 3–4, 7 |
| adminApi / envelope / correlation | 2 |
| Breadcrumbs / lang / notifications / footer | 5 |
| Date-range / tabs / dialogs / money / gates | 6 |
| migrate-pages | 7 |
| COA regressions | 1, 5 |
| No CRM/KPI | global |
