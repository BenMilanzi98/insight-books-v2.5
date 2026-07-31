# Data Quality & Reconciliation

| Check | Method |
|-------|--------|
| Duplicate analytics effect | Unique idempotencyKey on outbox + event |
| Missing events | Recon: operational count vs event count in period |
| Freshness | `AnalyticsDataFreshness.lastSuccessAt` vs now |
| Invalid payload | Schema validate before event persist; DLQ on fail |
| Cross-tenant | Reject outbox without tenantId when event is TENANT scoped |

Backfill: dry-run plans from real rows only; never invent history.
