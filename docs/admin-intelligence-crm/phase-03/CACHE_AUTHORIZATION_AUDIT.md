# Cache Authorisation Audit

| Finding | Class |
|---------|-------|
| `adminFetch` uses `cache: 'no-store'` | KEEP |
| Phase 2 cache scope conventions | EXTEND |
| No permission-change invalidation bus | STALE_PERMISSION_RISK |
| Search/notification caches empty/foundation | EXTEND |
| Shared browser state across roles | CLIENT risk — document |

**Target:** Cache keys include `adminId` + `permissionVersion` + scope; invalidate on assignment change.
