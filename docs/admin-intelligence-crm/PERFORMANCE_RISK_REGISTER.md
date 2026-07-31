# Performance Risk Register

**Audited:** 2026-07-28

| ID | Risk | Severity | Evidence | Later-phase guidance |
|----|------|----------|----------|----------------------|
| PERF-01 | Full-table aggregates on `Sale`/`Expense` for admin dashboard | High | `/api/admin/dashboard/stats` | Replace with Platform* + pre-aggregates; never scan all sales for SaaS KPIs |
| PERF-02 | Unbounded list endpoints without cursor pagination | Medium | Various admin APIs | Standardise cursor/limit |
| PERF-03 | N+1 Prisma includes on tenant trees | Medium | Tenant detail pages | Select only needed fields |
| PERF-04 | Chart pages loading entire history client-side | Medium | Recharts admin pages | Server-side date-bucketed series |
| PERF-05 | Future CRM activity timeline without indexes | High | When Lead/Activity added | Index `(ownerId, dueAt)`, `(leadId, occurredAt)` |
| PERF-06 | AnalyticsEvent write storm without batching | High | Future instrumentation | Queue + idempotent ingest |
| PERF-07 | Heavy admin reports blocking request thread | Medium | Export routes | Background job + download token |

## Phase 1

Diagnostic queries only; no new hot-path indexes unless audit blocked (requires explicit approval).
