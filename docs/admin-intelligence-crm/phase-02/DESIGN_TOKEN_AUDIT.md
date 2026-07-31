# Design Token Audit

## Existing

Admin shell uses CSS custom properties (evidence in AdminShell / admin CSS):

- `--admin-text`, `--admin-header-bg`, `--admin-surface-muted`, `--admin-radius`, `--admin-focus-ring`
- `--sidebar-width`, `--sidebar-collapsed-width`, `--admin-header-height`
- `--z-drawer`, `--z-backdrop`, `--motion-ease`

## Gaps

| Need | Status |
|------|--------|
| Documented token file (`styles/admin-tokens.css` or similar) | `STANDARDISE` — centralise if scattered |
| Density / spacing scale | Incomplete documentation |
| Status color tokens (success/warn/danger/info) | Partial via Tailwind ad-hoc |
| Chart color palette tokens | Incomplete |
| Dark theme | Not required unless already supported — do not invent |

## Phase 2 action

Centralise and document `--admin-*` tokens; components consume tokens only — no parallel design system.
