# Accessibility Foundation Audit

## Present

- Drawer `aria-label`, Escape close, focus return to menu button
- Header menu `aria-expanded` / `aria-controls`
- Focus-visible outlines on header controls

## Gaps

| Area | Gap |
|------|-----|
| Modals/drawers | Verify focus trap + initial focus + restore |
| Live regions | Loading/error announcements incomplete |
| Charts | Need text alternative / table fallback guidance |
| Language switcher | Must be keyboard operable when added |
| Breadcrumbs | `nav` + `aria-current` |
| Notifications | Dialog/popover pattern with focus management |

## Phase 2 action

Accessibility checklist tests for shell + new primitives; fix critical/high issues in shared components only.
