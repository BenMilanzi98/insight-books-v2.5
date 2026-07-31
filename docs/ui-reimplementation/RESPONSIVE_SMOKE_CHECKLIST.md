# Responsive / a11y smoke checklist

Manual verification targets: **320 / 768 / 1280 / 1920**.

## Shell

- [ ] Tenant: hamburger opens drawer; backdrop + Escape close; focus returns to menu
- [ ] Tenant: desktop sidebar open/closed content offset correct (no horizontal page scroll)
- [ ] Admin (`/insightbooks`): same drawer behaviour after login
- [ ] Long business / branch names truncate in AppBar without overflow

## Representative modules

| Surface | 320 | 768 | 1280 |
|---------|-----|-----|------|
| Dashboard | header wraps; cards stack | 2-col where designed | full layout |
| Clients / Invoices | PageHeader actions wrap; tables scroll/card | usable filters | full |
| Reports v2 | selector stacks; table scroll-x | side-by-side starts | full hub |

## Accessibility

- [ ] Focus visible on Button / menu / dialog close
- [ ] Dialog traps focus (Headless UI); Escape closes
- [ ] Form labels associated (FormField pattern)
- [ ] StatusBadge text present (not colour-only)
