# Component Deprecation Matrix

| Asset | Action | Migration |
|-------|--------|-----------|
| `components/Sidebar` `masterAdmin` insightbooks links | `DEPRECATE` | Platform admins use `/insightbooks` + AdminShell only |
| Hardcoded page titles in AdminHeader (`resolveTitle` English strings) | `REFACTOR` | Nav `labelKey` + `t()` |
| Ad-hoc `fetch('/api/admin/...')` without error envelope | `STANDARDISE` | Route through `adminApi` client |
| Dashboard subroute stub pages as “analytics” | `LEGACY_COMPATIBILITY` | Keep redirects; do not promote as Intelligence |
| `/insightbooks/subscription-payment` orphan page | `LEGACY_COMPATIBILITY` | Out of Phase 2 UI rewrite — flag only |
| Second chart/table libraries for admin | `REMOVE` (prevent) | Forbidden in Phase 2 |

Nothing removed from production billing/accounting in this phase.
