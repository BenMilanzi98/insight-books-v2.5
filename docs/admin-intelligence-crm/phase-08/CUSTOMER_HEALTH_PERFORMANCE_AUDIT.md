# Customer Health Performance Audit

| Concern | Finding | Guidance |
|---------|---------|----------|
| N+1 evaluate on directory | Risk if UI scores every row live | Prefer snapshots + async rebuild job; overview from aggregates |
| Commercial + engagement + EIS per tenant | 3–6 queries today in 360 | Reuse batched loaders where possible; cache definition in process |
| Signal open-count for relationship | Needs CustomerSignal query | Index `(tenantId, status)` already expected on Phase 7 model |
| Snapshot growth | Immutable rows | Partition/retention policy later; rebuild does not update in place |
| Command Centre fan-out | Cases + health + renewals | Paginate; portfolio filter first |

**Wave 1 target:** single-tenant evaluate &lt; 2s locally on warm DB; overview uses snapshot table counts, not live full fleet evaluate.
