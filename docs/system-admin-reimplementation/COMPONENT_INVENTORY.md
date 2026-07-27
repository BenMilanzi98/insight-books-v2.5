# Component Inventory — Admin Shell & Related

## Primary shell components

### `components/shell/AdminShell.jsx` — REUSE / STANDARDISE

| Aspect | Finding |
|--------|---------|
| Role | Platform admin chrome: drawer aside + AppBar + main + Footer |
| Pattern | Mirrors tenant AppShell (tokenized drawer, mobile overlay, Escape to close) |
| Props | `children`, `admin` |
| Tokens used | `--background-secondary`, `--surface-primary`, `--sidebar-width`, `--z-drawer`, `--z-backdrop`, `--motion-ease` |
| Children wiring | Renders `AdminSidebar` with `collapsed={!sidebarOpen}` |
| AppBar flags | `skipUserFetch`, `adminUser={admin}`, shared menu button ref / `navId` |
| Footer | `skipPermissions` |
| Gaps | Collapsed width becomes `w-0` (hides sidebar entirely) rather than icon rail; depends on AdminSidebar for actual nav content; no admin-specific breadcrumb/context strip |

### `components/AdminSidebar/AdminSidebar.js` — REFACTOR / STANDARDISE

| Aspect | Finding |
|--------|---------|
| Role | Fixed left nav for `/insightbooks/*` |
| Visual | Inline styles, dark `#1a202c`, **emoji** icons in nav config |
| Nav data | Hardcoded `navigation` array (Administration group only) |
| Includes | **System chart of accounts** → `/insightbooks/chart-of-accounts` (**REMOVE** from nav per locked decision) |
| Expandable | Billing & Subscriptions subItems (overview, subscriptions, invoices, payments) |
| Logout | `POST /api/admin/auth/logout` → `/insightbooks/login` |
| Collapsed mode | Shows logo + logout only — **nav items not available** when collapsed (NON_RESPONSIVE / INCOMPLETE) |
| Dead imports | Lucide icons imported (`BarChart3`, `Building2`, …) but emoji strings used in items |
| Permission awareness | None — all items shown to every admin |

### `app/insightbooks/layout.js` — KEEP / REFACTOR

| Aspect | Finding |
|--------|---------|
| Auth gate | Client-side `/api/admin/auth/me`; redirects to login if fail |
| Shell mount | Wraps authenticated pages in `AdminShell` |
| Login bypass | `/insightbooks/login` renders children without shell |
| Gap | Auth is client-only after middleware cookie check; no permission-based route hiding |

## Related shared components reused by admin

| Component | Path | Classification | Notes |
|-----------|------|----------------|-------|
| AppBar | `components/AppBar` | REUSE / STANDARDISE | Tenant bar with admin mode flags |
| Footer | `components/Footer` | REUSE | `skipPermissions` |
| SystemLedgerCoaTable | `components/chart-of-accounts/SystemLedgerCoaTable` | LEGACY_READ_ONLY / REMOVE-from-admin-UI | Used by admin CoA page; APIs remain |
| MRA EIS admin widgets | under `components` / feature folders | KEEP / EXTEND | Entitlement/centre UI |
| Mobile app admin UI | page-local + upload via Pages API | KEEP / EXTEND | |

## Design inconsistency matrix

| Token / pattern | AdminShell | AdminSidebar | Typical page |
|-----------------|------------|--------------|--------------|
| Colors | CSS vars | Hardcoded hex | Mix of indigo Tailwind + gray |
| Icons | N/A | Emoji | Lucide |
| Width | `--sidebar-width` | Fixed 280px / 80px | Full width in main |
| Motion | `--motion-ease` 200ms | `0.3s ease-in-out` | Ad-hoc |
| Cards | Avoided in shell | N/A | Heavy card grids on stub pages |

## Target component outcomes (Phase 2)

1. **AdminSidebar v2:** Lucide (or design-system icons), permission-filtered nav, CoA item removed, duplicates removed, working icon-rail collapse.
2. **AdminShell v2:** Single width contract; optional admin context header (role, environment badge).
3. Extract `adminNavigation.js` config (see ADMIN_NAVIGATION_ARCHITECTURE.md) — no emoji literals in JSX.
4. Shared admin primitives: `AdminPageHeader`, `AdminStat`, `AdminEmptyState`, `AdminNotice` (for `?notice=coa-removed`).
