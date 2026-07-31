# Admin Platform Foundation (Phase 2) — Design

**Date:** 2026-07-28  
**Status:** Approved 2026-07-28 · Implementation in progress  
**Decisions locked:** Approach **A** (extend-in-place) · Migration depth **`migrate-pages`**  
**Inputs:** `docs/admin-intelligence-crm/phase-01/` mapping + `phase-02/` audits + Phase 1 pack

---

## 1. Goal

Deliver one production-quality shared Administration Platform Foundation for `/insightbooks`, and migrate **existing maintained admin pages** onto that foundation so later Intelligence/CRM modules do not inherit a split world (new kit vs old ad-hoc pages).

## 2. Non-goals (unchanged)

- No Executive KPIs / MRR cards / CRM / leads / pipeline / AI / marketing attribution
- No billing callback or accounting behaviour changes
- No System Chart of Accounts admin UI
- No fake production metrics
- No second design system

## 3. Architecture

```text
AdminAppShell (= AdminShell, aliased)
├── AdminSidebar (adminNav + i18n labelKeys + complete NAV_PERMISSION_MAP)
├── AdminMobileNavigation (extracted behaviour from shell drawer)
├── AdminHeader
│   ├── menu trigger · AdminBreadcrumbs · GlobalSearch
│   ├── NotificationCentre (foundation, empty)
│   ├── LanguageSwitcher (en/ny)
│   └── UserMenu (identity + logout)
├── AdminSupportAccessBanner · AdminNoticeBanner · AdminContextBanner (actor)
├── AdminPageViewport → page content (migrated pages)
└── AdminFooter
```

**Libs**

| Module | Role |
|--------|------|
| `lib/admin/adminApi.js` | credentials, correlation header, envelope + legacy parse |
| `lib/admin/apiEnvelope.js` | server helpers (opt-in) |
| `lib/admin/correlation.js` | IDs |
| `lib/admin/queryState.js` | URL filter/date/pagination helpers |
| `lib/admin/scopes.js` | scope enum constants |
| `lib/admin/featureFlags.js` | foundation flags only |
| `lib/admin/adminNav.js` | `labelKey` per item; COA remains removed |
| `lib/admin/permissions.js` | complete map + `intel.*` / `crm.*` scaffolding (default deny) |

**i18n namespaces** (registered in `loadMessages.js`):

- `admin-shell` — chrome, nav, banners, search, notifications empty copy
- `admin-foundation` — shared kit strings (empty/error/loading, dialogs, money labels)
- `admin-pages` — per-route page chrome + primary actions (migrate-pages)
- extend `administration` only if needed for parity with existing keys

## 4. What `migrate-pages` means (acceptance)

For every **maintained** page under `app/insightbooks/**` (exclusions below):

| Requirement | Done when |
|-------------|-----------|
| Data access | Primary GETs/mutations use `adminApi` (not raw `fetch`) |
| Page chrome | Title, description, primary buttons, empty/error/loading via `t('admin-pages.*')` or foundation keys |
| Kit | Uses AdminPageHeader / Container / states / table/filter/modal from `components/admin` where applicable |
| Money UI | Any new or touched amount display uses `AdminMoney` with explicit `sourceContext` |
| Permissions | Destructive/primary actions wrapped in `AdminPermissionGate` where a permission key exists |
| a11y / overflow | No page-wide horizontal overflow; focus patterns from shared modals/drawers |

**Excluded from deep migration (legacy compatibility only):**

- Redirect stubs: `chart-of-accounts`, `affiliate-system`, `audit-logs`, `billing` index, dashboard analytics stubs that only redirect
- Orphan `subscription-payment` — leave behaviour; optional notice string only if touched
- Login page — migrate chrome/i18n (auth flow logic unchanged)

**String depth:** Migrate **user-visible chrome + actions + states + column headers** on maintained pages. Do not block Phase 2 on translating every dynamic status enum / every toast edge case; remaining strings tracked as follow-ups in phase-02 README.

**API envelope:** New helpers available; migrate client calls first. Server routes may keep legacy JSON; `adminApi` must accept both. Opt-in envelope on routes only when cheap — no mass API rewrite.

## 5. Component plan

**Extend:** AdminShell→AdminAppShell, AdminHeader, AdminSidebar, AdminGlobalSearch, AdminDataTable, AdminFilterBar, states, modals/drawers, charts (no fake KPI pages).

**Add:** AdminBreadcrumbs, AdminDateRangePicker, AdminTabs, AdminAccordion, AdminNotificationCentre, AdminExportDialog, AdminImportDialog, AdminMoney, AdminPermissionGate, AdminScopeBadge, AdminFooter, AdminLanguageSwitcher, AdminContextBanner.

**Deprecate (docs + stop using for control plane):** Sidebar `masterAdmin` as platform nav. Do not delete tenant Sidebar.

## 6. Security

- Server guards remain authoritative
- Complete `NAV_PERMISSION_MAP` for every adminNav href (fail tests if missing)
- Client gates are UX only
- Search/breadcrumbs/quick actions never surface System CoA
- Scope helpers never silently widen TENANT_SCOPED → PLATFORM_GLOBAL

## 7. Testing

- COA: nav desktop/mobile, search, breadcrumbs, tenant CoA intact
- Nav permission map completeness
- en/ny key parity for admin-shell, admin-foundation, admin-pages
- adminApi unit tests
- AdminPermissionGate unit tests
- Smoke: at least one migrated page per major area (dashboard, tenants, billing, mra-eis, email, audit) still loads kit patterns (unit/integration as feasible)

## 8. Implementation waves

1. **WS0** Safety tests (map + COA extensions)  
2. **WS1** Libs + tokens + permission scaffolding  
3. **WS2** Shell i18n + new chrome components  
4. **WS3** Shared primitives (date-range, tabs, dialogs, money, gates)  
5. **WS4** Page migration by area: dashboard → tenants/users → billing → mra-eis → email → affiliate → security/audit/health → settings/mobile/reports/imports  
6. **WS5** Regression suite + phase-02 completion notes  

## 9. Risks

| Risk | Mitigation |
|------|------------|
| migrate-pages scope explosion | Chrome+actions+adminApi bar; track residual strings |
| i18n key sprawl | Nested keys by route segment |
| Behaviour regressions | No billing/accounting logic edits; tests before page waves |
| Permission map too strict | Map to existing `billing.view` etc.; do not invent new required perms for current pages |

## 10. Approval

Approve this spec to proceed to the detailed implementation plan and code.

Reply: **`approve phase-2 design`** or list requested changes.
