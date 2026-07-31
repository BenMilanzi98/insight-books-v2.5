# Product Performance Audit

| Concern | Guidance |
|---------|----------|
| Fleet-wide live evaluate of all events | Forbidden — use snapshots / pre-aggregates |
| Client-side funnel/cohort calc | Forbidden |
| N+1 per module on overview | Paginate; snapshot counts |
| Journey unbounded | Cap length; aggregate paths |
| Producer write storm | Outbox batch + idempotency (Phase 4) |

**Wave 1 target:** Commerce producers must not block invoice/POS request path beyond outbox enqueue.
