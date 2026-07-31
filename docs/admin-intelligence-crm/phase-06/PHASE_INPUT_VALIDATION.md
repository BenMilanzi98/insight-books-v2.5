# Phase 6 Input Validation

| Prior asset | Usable? | Phase 6 use |
|-------------|---------|-------------|
| `computeSaasBillingKpis` | Yes | Point-in-time contracted MRR baseline |
| Executive KPI pack | Yes | Soft-link; shared envelope rules |
| `PlatformPayment` | Yes | Collected cash |
| `PlatformInvoice` | Partial | Billed/outstanding; may be sparse vs PayChangu path |
| `PlatformCredit` / `PlatformRefund` | Yes | Adjustments |
| `AccountSubscription` | Yes | Reconstruct MRR; product split via plan codes |
| `PlatformPlanVersion.planCategory` | Yes | CORE vs MRA_EIS |
| `AnalyticsFactSubscription` | Partial | Lifecycle; no amount-delta events |
| `AnalyticsDailySnapshot` | Partial | Extend with `mrr_estimated_*` keys |
| Payment recon | Yes | Count-level; extend for revenue recon |
| Tenant Sale / `/api/admin/analytics` | **No** | Forbidden for platform revenue |
| Tenant industry/country | **No** | Slices UNAVAILABLE |
| FX rate table | **No** | Cross-currency totals UNAVAILABLE |

**Conclusion:** Proceed under CONDITIONAL GO; matrix gates each metric.
