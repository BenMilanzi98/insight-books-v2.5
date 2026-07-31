# Navigation Foundation Audit

## Canonical

`lib/admin/adminNav.js` → `AdminSidebar` → AdminShell.

## Gaps

| Gap | Class | Fix in Phase 2 |
|-----|-------|----------------|
| Nav labels hardcoded English | i18n | Add `labelKey` per item; translate |
| `NAV_PERMISSION_MAP` incomplete for billing children | `UNSAFE` | Complete map |
| Sidebar masterAdmin drift | `DUPLICATED` | Deprecate documentation + optional hide |
| COA removed | Verified | Add search + breadcrumb + mobile regression tests |
| Future intel/crm nav | Not now | Optional disabled placeholder section **only if** product wants — default: **omit** until later phases |

## COA regression (Phase 2 must add/extend)

- Desktop nav
- Mobile nav
- Global search results
- Breadcrumbs
- Quick actions (if any)
- Tenant `/chart-of-accounts` still exists
