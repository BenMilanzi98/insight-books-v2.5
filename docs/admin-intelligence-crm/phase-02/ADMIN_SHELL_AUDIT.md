# Admin Shell Audit

## Current: `AdminShell`

Supports: desktop sidebar, collapse, mobile drawer + backdrop, Escape close, focus return, header, support banner, notice banner, global search, page viewport.

Missing vs target `AdminAppShell`:

- Named `AdminMobileNavigation` extraction (logic embedded)
- Breadcrumbs in header
- Language switcher
- Notification centre trigger + panel foundation
- Theme switcher (only if already supported elsewhere — do not invent)
- Explicit real-actor / effective-actor display beyond support banner
- Footer / version region
- i18n of aria-labels

## Decision

**Extend `AdminShell` → export as `AdminAppShell` (alias)** — zero dual-shell migration.

File plan:

- Keep `components/shell/AdminShell.jsx` as implementation
- Re-export `AdminAppShell` from same module or thin wrapper
- Layout continues importing one shell only
