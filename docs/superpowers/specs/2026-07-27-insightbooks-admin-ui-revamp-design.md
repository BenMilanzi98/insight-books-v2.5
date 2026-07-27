# InsightBooks Admin UI Revamp — Design Spec

**Date:** 2026-07-27  
**Surface:** `/insightbooks` System Administration control plane  
**Status:** Approved for planning (awaiting user review of this file)

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Visual direction | **A — Calm ops console** (dense, slate, Lucide, Linear/Vercel-ops feel) |
| Delivery | **Wave delivery** — each wave production-usable |
| Shell chrome | **Dedicated admin header**; remove tenant AppBar + Footer |
| Implementation approach | **Progressive shell + shared kit**, migrate pages in place; APIs unchanged |

## Goals

1. Refresh the entire `/insightbooks` UI onto one coherent, modern ops design system.
2. Fully responsive **320px–1920px** with no page-wide horizontal overflow.
3. Preserve all existing admin APIs, permissions, and business behavior (UI-only).
4. Ship in waves so operators can use each slice as it lands.

## Non-goals

- Tenant app (`/dashboard`, `/chart-of-accounts`, POS, etc.) redesign
- New backend features, schema changes, or permission model changes
- Greenfield parallel admin route tree
- Marketing-site aesthetics (heroes, promo cards, purple gradients, pill farms)

## Visual system

### Look & feel

- Internal ops tool: high signal, low decoration
- Canvas: slate (`#F8FAFC` / `#F1F5F9`)
- Panels: white surfaces, hairline borders, minimal shadow
- Sidebar: dark slate (`#0F172A`), muted labels, clear active state
- Accent: existing `--action-primary` (not purple marketing gradients)
- Icons: Lucide only
- Typography: strong hierarchy (page title → section → body → mono for IDs)

### Tokens

Expand `--admin-*` in `app/globals.css`:

- Background / surface / elevated / border / muted text
- Sidebar bg / text / muted / active
- Header bg / border
- Focus ring, danger / warning / success
- Density spacing scale, table row height
- Content max width (~1600px)
- Sidebar / collapsed widths

### Breakpoints

| Name | Width | Behavior |
|------|-------|----------|
| Mobile | `<768` | Drawer nav; tables → card lists; filters → sheet |
| Tablet | `768–1024` | Collapsible sidebar; hybrid density |
| Desktop | `>1024` | Full sidebar; sticky table headers where useful |

### Motion

Only 2–3 intentional motions: drawer slide, search/header panel, dialog enter. No decorative dashboard animation.

### Accessibility

- Mobile drawer: Escape, focus restore, body scroll lock
- Do not rely on color alone for status (badge text)
- Touch targets ≥44px on mobile
- Sidebar `aria-label="Admin navigation"`

## Architecture

### Approach

Progressive enhancement of the existing control plane:

1. Tokens + shell chrome
2. Shared primitives under `components/admin/*`
3. Migrate page bodies wave-by-wave onto those primitives
4. Leave redirect-only routes as redirects

### Key files

| Area | Paths |
|------|--------|
| Shell | `components/shell/AdminShell.jsx`, new `AdminHeader`, `components/AdminSidebar/AdminSidebar.js` |
| Primitives | `components/admin/*` |
| Tokens | `app/globals.css` (`--admin-*`) |
| Nav config | `lib/admin/adminNav.js` |
| Pages | `app/insightbooks/**/page.js` |

### Data / APIs

- **No API contract changes** for this program
- Pages keep existing `fetch('/api/admin/...')` calls
- Empty / error / loading must be honest (no fake metrics)

## Shared primitives

| Primitive | Responsibility |
|-----------|----------------|
| `AdminHeader` | Menu toggle, title/breadcrumb slot, global search, env badge, admin identity, logout |
| `AdminPageContainer` / `AdminPageHeader` | Standard page frame |
| `AdminDataTable` | Desktop table + mobile card list from same columns/data |
| `AdminFilterBar` | Search + filters; mobile sheet |
| `AdminForm` field kit | Label, input, select, textarea, checkbox, inline error |
| `AdminModal` / `AdminDrawer` | Overlay patterns |
| `AdminConfirmationDialog` | Destructive confirms |
| `AdminSummaryCard` / `AdminStatusBadge` | Real metrics / status only |
| `AdminEmptyState` / `AdminLoadingState` / `AdminErrorState` | Honest states |
| `AdminNoticeBanner` / `AdminSupportAccessBanner` | Keep |
| `AdminGlobalSearch` | Keep; restyle to match header |

### Page layout pattern

Every migrated screen:

1. Page header (title + one supporting line + actions)
2. Optional summary strip (real metrics only)
3. Filter bar
4. Primary data surface (table → cards on mobile)
5. Modals/drawers for create/edit

## Delivery waves

### Wave 1 — Foundation

- Tokens
- `AdminShell` + `AdminHeader` + sidebar polish
- Primitives: `AdminDataTable`, `AdminFilterBar`, form fields, modal/drawer
- Redirect-only pages untouched
- **Exit:** Shell looks finished on all routes; primitives ready for Wave 2

### Wave 2 — Core ops

- Dashboard
- Tenant management
- User management
- Global settings
- Feature entitlements

### Wave 3 — Revenue & partners

- Billing (overview, plans, subscriptions, invoices, payments, credits, reconciliation)
- Affiliate (+ commissions, payouts)
- Email management (+ templates, suppression)

### Wave 4 — Compliance & remaining

- MRA EIS suite
- Audit, security (overview/monitoring/compliance)
- System health, reports, imports
- Login polish
- Leftover dashboard analytics subpages

## Success criteria (per wave)

- [ ] Usable 320px–1920px; no page-wide overflow
- [ ] Shared kit only (no one-off indigo card farms on migrated pages)
- [ ] Real empty/error/loading; no invented metrics
- [ ] Escape closes drawers/dialogs; focus restore on mobile nav
- [ ] APIs and permissions unchanged
- [ ] Smoke: navigate primary wave routes on mobile + desktop widths

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Large legacy pages (affiliate, email, users) | Migrate incrementally; extract table/filter first |
| Visual inconsistency mid-program | Shell/tokens Wave 1 so unmigrated pages still sit in finished chrome |
| Accidental API/behavior change | UI-only PRs; keep fetch contracts; regression via `test/systemAdmin*` |
| Scope creep into tenant UI | Explicit non-goal |

## Spec self-review

- [x] No unresolved placeholders (TODO/TBD)
- [x] Decisions consistent with brainstorm (A / waves / dedicated chrome / Approach 1)
- [x] Scope bounded to `/insightbooks` UI
- [x] Waves are independently shippable

## Next step

After user approval of this spec → write Wave 1 implementation plan (`writing-plans`) → implement Wave 1.
