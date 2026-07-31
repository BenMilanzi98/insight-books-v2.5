# Permission Foundation Audit

## Present

- `SYSTEM_ADMIN_PERMISSIONS` rich catalog
- `adminHasPermission` / `requireAdminPermission`
- `NAV_PERMISSION_MAP` (incomplete for billing children)
- Role presets

## Phase 2 foundation work

| Item | Action |
|------|--------|
| Complete `NAV_PERMISSION_MAP` for every adminNav href | Required |
| Add scaffolding keys `intel.*.read`, `crm.leads.view` (etc.) | Keys only — unused until later |
| `AdminPermissionGate` client component | Hide/disable UI only |
| Document: nav ≠ security | README + comments |
| Do not widen existing roles to auto-grant intel/crm | Default deny |

Server-side API guards remain authoritative — Phase 2 does not weaken them.
