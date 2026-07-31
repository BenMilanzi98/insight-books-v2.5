# Target Analytics Architecture

```text
Operational TX → AnalyticsOutbox → Dispatcher → AnalyticsEvent
  → Idempotent consumers → Facts → Daily/Monthly snapshots
  → Reconciliation → Pipeline health UI / future dashboards
```

**Principles:** Operational SoT; analytics derived + rebuildable; at-least-once + idempotent consumers; zero Sale-as-SaaS; tenantId on tenant-scoped events; authZ on admin pipeline APIs via Phase 3 decision service.
