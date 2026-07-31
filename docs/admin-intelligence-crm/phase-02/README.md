# Phase 2 — Shared Admin Platform Foundation

**Status:** Foundation + page-chrome i18n + billing-truth hardening landed  
**Date:** 2026-07-28  
**Design:** [../../superpowers/specs/2026-07-28-admin-platform-foundation-phase-02-design.md](../../superpowers/specs/2026-07-28-admin-platform-foundation-phase-02-design.md)  
**Plan:** [../../superpowers/plans/2026-07-28-admin-platform-foundation-phase-02.md](../../superpowers/plans/2026-07-28-admin-platform-foundation-phase-02.md)  
**Billing truth:** [./BILLING_TRUTH_HARDENING.md](./BILLING_TRUTH_HARDENING.md)  
**Boundary:** Shared foundation + migrate maintained admin pages onto it — **no** Intelligence/CRM business modules

## Landed so far

- `AdminAppShell` alias + footer, language switcher, notification centre (empty), breadcrumbs, context banner
- `adminApi` / `adminFetch` + correlation, scopes, envelopes, queryState, foundation flags
- Complete `NAV_PERMISSION_MAP` + unmapped hrefs hidden
- Locales: `admin-shell`, `admin-foundation`, `admin-pages` (en/ny)
- Maintained pages: primary `/api/admin` calls → `adminFetch` / `adminApi`
- Page chrome: `AdminPageHeader` titles wired to `admin-pages.*` across areas
- Shared primitives: Money, PermissionGate, DateRange, Tabs, Accordion, Export/Import dialogs
- SaaS billing KPIs: dashboard/overview no longer treat Tenant Sale as platform revenue

## Residual

- Secondary in-page copy (table actions, modal bodies, filter labels) still partially English
- Dashboard stats still *queries* Sale aggregates for `tenantActivity` (not exposed as SaaS) — optional perf cleanup later

## Inputs

- Phase 1 pack: [../phase-01/README.md](../phase-01/README.md) → [../README.md](../README.md)
- Master prompt: `Inteligence & Leads.txt` Phase 2

## Deliverables (this folder)

| Document | Purpose |
|----------|---------|
| [PHASE_02_SCOPE.md](./PHASE_02_SCOPE.md) | In / out of scope |
| [PHASE_01_INPUT_VALIDATION.md](./PHASE_01_INPUT_VALIDATION.md) | Path + completeness check |
| [CURRENT_FOUNDATION_AUDIT.md](./CURRENT_FOUNDATION_AUDIT.md) | What already exists |
| [COMPONENT_REUSE_MATRIX.md](./COMPONENT_REUSE_MATRIX.md) | KEEP / EXTEND / … |
| [COMPONENT_DEPRECATION_MATRIX.md](./COMPONENT_DEPRECATION_MATRIX.md) | What to stop using |
| [DESIGN_TOKEN_AUDIT.md](./DESIGN_TOKEN_AUDIT.md) | CSS variables / tokens |
| [ADMIN_SHELL_AUDIT.md](./ADMIN_SHELL_AUDIT.md) | AdminShell vs target AdminAppShell |
| [NAVIGATION_FOUNDATION_AUDIT.md](./NAVIGATION_FOUNDATION_AUDIT.md) | Nav + COA + permission map |
| [RESPONSIVE_FOUNDATION_AUDIT.md](./RESPONSIVE_FOUNDATION_AUDIT.md) | 320px+ strategy |
| [ACCESSIBILITY_FOUNDATION_AUDIT.md](./ACCESSIBILITY_FOUNDATION_AUDIT.md) | a11y gaps |
| [I18N_FOUNDATION_AUDIT.md](./I18N_FOUNDATION_AUDIT.md) | en/ny admin gaps |
| [PERMISSION_FOUNDATION_AUDIT.md](./PERMISSION_FOUNDATION_AUDIT.md) | Guards + map gaps |
| [ERROR_HANDLING_AUDIT.md](./ERROR_HANDLING_AUDIT.md) | Error contracts |
| [API_CLIENT_AUDIT.md](./API_CLIENT_AUDIT.md) | Admin fetch patterns |
| [QUERY_STATE_AUDIT.md](./QUERY_STATE_AUDIT.md) | Filters / URL state |
| [CACHE_FOUNDATION_AUDIT.md](./CACHE_FOUNDATION_AUDIT.md) | Caching rules |
| [OBSERVABILITY_FOUNDATION_AUDIT.md](./OBSERVABILITY_FOUNDATION_AUDIT.md) | Correlation / audit helpers |
| [TEST_FOUNDATION_AUDIT.md](./TEST_FOUNDATION_AUDIT.md) | Test strategy |
| [PHASE_02_GAP_REGISTER.md](./PHASE_02_GAP_REGISTER.md) | Prioritised foundation gaps |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Ordered build plan |

## Non-goals

Executive KPIs, CRM, fake production metrics, billing logic changes, accounting changes, System CoA reintroduction.
