# Phase 2 Scope

## Locked product decisions

| Decision | Value |
|----------|-------|
| Approach | **A** — extend-in-place (no second shell/kit) |
| Page depth | **`migrate-pages`** — maintained pages → adminApi + chrome i18n + kit (see design §4) |

## In scope

| Area | Deliverable |
|------|-------------|
| Shell | Canonical AdminAppShell (extend existing AdminShell) |
| Nav | Desktop sidebar, mobile drawer, COA regression tests |
| Header | Breadcrumbs, search trigger, language switcher, user menu, notification foundation |
| Design system | Tokens + shared components (table, form, filter, modal, drawer, states, charts shells) |
| i18n | `administration` + new `admin-shell` / `admin-foundation` namespaces (en + ny) |
| Permissions | Complete NAV_PERMISSION_MAP; client `AdminPermissionGate`; server remains authoritative |
| Scope | Explicit scope tags on shared query helpers |
| API | Safe admin fetch client + error envelope + correlation ID header |
| Observability | Audit helper wrappers; request correlation utilities |
| Feature flags | Admin foundation flag helper (no business modules) |
| Tests | Shell, nav, COA, i18n parity, permission map, API client unit tests |
| Placeholders | Optional route stubs that state “not implemented this phase” — no fake metrics |

## Out of scope

- All Intelligence / CRM / Marketing / AI business modules
- SaaS MRR/ARR calculation fixes (documented Phase 1 P0 — preserve as later unless user expands scope)
- Billing write-path changes
- Tenant accounting / CoA admin UI
- New SupportTicket domain
- Visual regression tooling beyond what Vitest/RTL can cover unless already present

## Foundation-level blockers from Phase 1 that Phase 2 **will** address

| Blocker | Phase 2 action |
|---------|----------------|
| Dual nav (Sidebar masterAdmin drift) | Document deprecation; ensure AdminShell-only for `/insightbooks` |
| NAV_PERMISSION_MAP incomplete | Complete map for all adminNav hrefs |
| Admin hardcoded English | Wire I18n + translation keys for foundation UI |
| Missing date-range / notification / export dialog foundations | Add shared components (empty/neutral — no fake data) |
| Missing intel.*/crm.* permission keys scaffolding | Add keys only; no pages |

## Foundation-level blockers Phase 2 will **not** fix (preserve)

| Blocker | Deferred to |
|---------|-------------|
| Dashboard stats using Tenant Sale as revenue | Billing-truth / Intelligence phase |
| PayChangu ↔ PlatformInvoice disconnect | Billing hardening |
| Lead/CRM models | Phase 14+ |
| AnalyticsEvent store | Instrumentation phase |
