# Route Authorisation Audit

| Layer | Finding | Class |
|-------|---------|-------|
| `middleware.js` `/insightbooks` | Cookie presence only | UNSAFE |
| `app/insightbooks/layout.js` | Client `/me` | CLIENT_ONLY_SECURITY |
| Page permission redirect | None server-side | MISSING |
| Nav hide | Permission map | CLIENT_ONLY_SECURITY |
| System CoA | Redirect stub + REMOVED_ADMIN_ROUTES | KEEP |
| Deep links | Work with any valid cookie; APIs may 403 | PRIVILEGE_ESCALATION_RISK |

**Target:** Middleware verifies JWT + isActive; optional server layout permission check against NAV_PERMISSION_MAP; COA remains absent from nav/search/commands.
