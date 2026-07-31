# Phase 7 Input Validation

| Prior asset | Usable? | Use |
|-------------|---------|-----|
| `Tenant` / `Branch` / `User` | Yes | Identity + hierarchy |
| `AccountSubscription` | Yes | Lifecycle + commercial |
| Phase 6 revenue packs | Yes | MRR, billing, renewals |
| `AnalyticsFactTenantActivity` + USER_LOGIN | Partial | Engagement proxy |
| `MraEisTenantEntitlement` | Yes | EIS commercial/readiness dims |
| FEATURE_USED | No | Adoption UNAVAILABLE |
| Unique-user DAU facts | No | DAU UNAVAILABLE |
| SupportTicket | No | Support NOT_INSTRUMENTED |
| CustomerPortfolio | No | Build in Wave 3 |
| Tenant Sale / `/api/admin/analytics` Sale | **Forbidden** | Never |

**Conclusion:** CONDITIONAL GO — ship 360 with partial sections; matrix-gate the rest.
