# Admin Design System — Tokens Plan

## Intent

Give System Admin a coherent visual language that **reuses** existing CSS variables from the tenant shell where possible, while avoiding the emoji/inline-style AdminSidebar look and stub-page indigo card grids.

Admin is an **internal ops** product: dense, calm, high-signal — not a marketing landing page. Prefer clarity over decoration.

**Wave 1 shipped (2026-07-27):** calm-ops `--admin-*` tokens; dedicated `AdminHeader` (no AppBar/Footer); primitives `AdminDataTable`, `AdminFilterBar`, `AdminField`, `AdminModal`, `AdminDrawer`. Spec: `docs/superpowers/specs/2026-07-27-insightbooks-admin-ui-revamp-design.md`.

## Token sources (REUSE)

Prefer variables already used by `AdminShell`:

| Token | Role |
|-------|------|
| `--background-secondary` | App canvas |
| `--surface-primary` | Sidebar / panels |
| `--action-primary` | Primary actions / spinner accent (layout loader) |
| `--sidebar-width` | Desktop drawer width |
| `--z-drawer`, `--z-backdrop` | Layering |
| `--motion-ease` | Transitions |

## Admin-specific token plan (EXTEND)

Introduce under a clear prefix (implement in global CSS when Phase 2 lands):

| Token | Purpose | Guidance |
|-------|---------|----------|
| `--admin-nav-bg` | Sidebar background | Align with `--surface-primary` or subtle darker variant — **avoid** random `#1a202c` hardcode drift |
| `--admin-nav-fg` | Nav text | High contrast on nav bg |
| `--admin-nav-fg-muted` | Secondary labels | |
| `--admin-nav-active-bg` | Active item | |
| `--admin-nav-active-fg` | Active text | |
| `--admin-danger` | Destructive (tenant delete, force lock) | |
| `--admin-warning` | Trials expiring, maintenance | |
| `--admin-success` | Active subscriptions | |
| `--admin-notice-bg/fg` | `?notice=` banners | |
| `--admin-env-badge-*` | staging/production indicator | |
| `--admin-font-sans` | UI font | Match app design system; do not invent a third stack |
| `--admin-font-mono` | IDs, txRef, tenant ids | |
| `--admin-space-*` | 4/8/12/16/24 scale | Align with existing spacing |
| `--admin-radius-*` | Controls | Match app; avoid pill-heavy chrome |

## Iconography — STANDARDISE

- **Lucide** (already depended on) for all nav and page icons.
- **Remove emoji** from AdminSidebar navigation config.
- Sizes: nav 18–20px; page headers 20–24px.

## Component primitives (Phase 2)

| Primitive | Job |
|-----------|-----|
| `AdminPageHeader` | Title + one supporting line + actions |
| `AdminNotice` | Query/flash notices (coa-removed) |
| `AdminStat` | Single metric — only where interactive/ops useful |
| `AdminEmptyState` | No stubs: honest empty |
| `AdminConfirmDialog` | Destructive cross-tenant actions |
| `AdminDataTable` | Paginated lists (tenants, subscriptions) |
| `AdminBadge` | status/plan/env |

## Anti-patterns to REMOVE

- Fake stats (`Total Invoices: 156`) on stub pages.
- Mixed indigo-600 marketing buttons vs token primary.
- Card grids that convey no action (dashboard clutter).
- Inline style objects for layout chrome.
- Emoji as navigation affordances.

## Motion

Reuse shell drawer 200ms ease. Add 2–3 intentional motions only: drawer, notice enter, confirm dialog — not decorative dashboard animations.

## Accessibility

- Sidebar `aria-label="Admin navigation"` KEEP.
- Focus return from mobile overlay KEEP (AdminShell already).
- Do not rely on color alone for subscription status (include text).
