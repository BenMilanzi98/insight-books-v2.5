# Admin App Shell

## Current architecture — REUSE / STANDARDISE

```
app/insightbooks/layout.js
  ├─ login → children only
  └─ authenticated → AdminShell(admin)
        ├─ aside → AdminSidebar
        ├─ mobile backdrop
        ├─ AppBar (adminUser, skipUserFetch)
        ├─ main → page
        └─ Footer (skipPermissions)
```

Auth layers:

1. `middleware.js` — `admin_token` cookie for `/insightbooks/*` (except login); `/admin` → `/insightbooks` rewrite.
2. Layout — `/api/admin/auth/me` loads admin profile into shell.

## Responsibilities

| Layer | Owns | Must not own |
|-------|------|--------------|
| Middleware | Gate cookie / future JWT | Feature permissions UI |
| Layout | Session hydrate, shell mount | Business data fetching for features |
| AdminShell | Chrome, drawer, responsive | Nav item business rules (delegate to config) |
| AdminSidebar | Render nav from config | Hardcoded CoA / stubs (after Phase 1–2) |
| Pages | Domain UI | Re-implementing shell |

## Target shell behavior (Phase 2)

1. **Desktop:** persistent drawer at `--sidebar-width`; collapse to **icon rail** (not `w-0` empty).
2. **Mobile:** off-canvas drawer + backdrop + Escape; body scroll lock (already present — KEEP).
3. **Context strip (optional):** admin name, role, environment badge.
4. **Notices:** render `AdminNotice` from searchParams in shell or dashboard only.
5. **Permission filter:** sidebar receives `admin` and filters via `systemAdmin.*` / `system.eis.*`.

## Collapsed mode — REFACTOR

Today collapsed AdminSidebar shows logo + logout only. Target:

- Icon-only links for top-level items.
- Tooltips with labels.
- Expandable groups open as flyout or temporarily expand.

## Shared components

| Component | Classification | Change |
|-----------|----------------|--------|
| AppBar | REUSE | Keep admin flags; consider admin-specific title |
| Footer | REUSE | Keep skipPermissions; minimize tenant marketing links if any |
| AdminShell | REUSE / STANDARDISE | Align width with sidebar tokens |
| AdminSidebar | REFACTOR | Tokens, Lucide, config-driven |

## Login shell exception — KEEP

`/insightbooks/login` remains outside AdminShell (no nav flash before auth).

## Performance

Avoid double auth waterfalls where possible (Phase 2): middleware validates JWT; layout can trust short-lived client cache of `/auth/me`.
