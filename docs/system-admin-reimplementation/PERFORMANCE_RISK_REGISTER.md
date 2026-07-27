# Performance Risk Register (System Admin)

| ID | Risk | Evidence | Severity | Classification | Phase |
|----|------|----------|----------|----------------|-------|
| PERF-01 | `new PrismaClient()` per request + `$disconnect` | metrics, settings, invoices, many legacy admin routes | High | REFACTOR | 2 |
| PERF-02 | Unbounded or high default list limits | invoices `limit` default 100; other list endpoints without pagination | Medium | INCOMPLETE | 3–5 |
| PERF-03 | Dashboard fans out multiple heavy counts | metrics/stats/analytics parallel counts | Medium | EXTEND | 6 |
| PERF-04 | Admin CoA page huge client bundle | 2k+ line page + catalog merge | Medium | REMOVE (UI) mitigates | 1 |
| PERF-05 | N+1 includes on tenant/subscription lists | tenants/subscriptions include graphs | Medium | REFACTOR | 3 |
| PERF-06 | Mobile analytics event table growth | `MobileAppClientEvent` indexes exist; no retention policy documented | Medium | EXTEND | 3 |
| PERF-07 | Audit log tables unbounded UI page size | audit page pagination present — keep; avoid loading all | Low | KEEP pattern | 6 |
| PERF-08 | os.loadavg metrics on Windows/hosting mismatch | `metrics` uses `os.loadavg` | Low | INCOMPLETE | 6 |
| PERF-09 | Sidebar/layout client auth waterfall | layout waits on `/auth/me` after middleware | Medium | REFACTOR | 2 |
| PERF-10 | Stub pages fake 1s `setTimeout` loaders | invoices/payments/settings | Low | STUB (remove) | 1 |
| PERF-11 | MRA EIS admin pages pulling large mapping/catalogue sets | mappings/catalogue APIs | Medium | EXTEND (paging) | 4 |
| PERF-12 | Reports generation synchronous | `reports` routes | Medium | INCOMPLETE | 6 |

## Target standards

- Shared `lib/prisma` singleton only.
- Cursor/offset pagination on all admin lists (default page size ≤ 50).
- Server components or route handlers for aggregate dashboards where possible; cache short TTL for expensive counts.
- After CoA UI removal, drop heavy admin CoA client chunks from the admin graph.
- Define retention for `MobileAppClientEvent` and audit/event tables.
