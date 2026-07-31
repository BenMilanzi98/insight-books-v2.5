# KPI Source Readiness Audit

| Metric code | Class | Source |
|-------------|-------|--------|
| `platform.mrr.estimated` | READY_WITH_LIMITATIONS | `computeSaasBillingKpis` |
| `platform.arr.estimated` | READY_WITH_LIMITATIONS | MRR×12 approximate |
| `platform.payments.collected_period` | READY_WITH_RECONCILIATION | PlatformPayment + recon |
| `platform.payments.collected_all_time` | READY | PlatformPayment |
| `tenants.active_paid` | READY | distinctActivePaidTenants |
| `tenants.trial` | READY | trialSubscriptions |
| `subscriptions.active` | READY | activeSubscriptionRows |
| `tenants.total` | READY_WITH_LIMITATIONS | Tenant.count |
| `users.total` | READY_WITH_LIMITATIONS | User.count |
| `engagement.dau` | NOT_CURRENTLY_SUPPORTED | No unique-user DAU facts |
| `product.feature_adoption` | NOT_CURRENTLY_SUPPORTED | No FEATURE_USED emitters |
| `crm.pipeline` | DEFER_TO_LATER_PHASE | No CRM models |
| `support.pressure` | NOT_CURRENTLY_SUPPORTED | No tickets |
| `mra_eis.entitled` | READY_WITH_LIMITATIONS | MraEisTenantEntitlement counts |
| `ops.system_health` | READY_WITH_LIMITATIONS | system-health API signals |
| `security.posture` | PARTIALLY_READY | Prefer real monitoring; avoid theatrical placeholders |
| `pipeline.freshness` | READY | AnalyticsDataFreshness |

Never use `/api/admin/analytics` Sale aggregates for executive KPIs.
