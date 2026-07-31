# Search Authorisation Audit

| Asset | Finding | Class |
|-------|---------|-------|
| `resolveSearchScopes` | Filters domains by view permissions | KEEP |
| Hit sanitisation + limit ≤25 | Present | KEEP |
| Cross-tenant restriction for limited admins | Not applied via AdminTenantAccess | CROSS_TENANT_RISK |
| System CoA in search | Must remain absent | KEEP (verify in tests) |

**Target:** Search providers call decision service; tenant hits filtered by allow-list.
