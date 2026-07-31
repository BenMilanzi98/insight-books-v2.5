# Customer Source Readiness Matrix

| Field / metric | Class | Source |
|----------------|-------|--------|
| Tenant identity / name / status | READY | `Tenant` |
| Customer since | READY | `Tenant.createdAt` |
| Branch count | READY | `Branch` count |
| User / active user count | READY_WITH_LIMITATIONS | `User` (`isActive`/`status`) |
| Lifecycle stage | READY_WITH_LIMITATIONS | Tenant + subscription rules |
| Plan / subscription status | READY_WITH_LIMITATIONS | `AccountSubscription` |
| Estimated MRR / ARR | READY_WITH_LIMITATIONS | Phase 6 normalize / pack |
| Billed / collected / outstanding | READY_WITH_LIMITATIONS | PlatformInvoice / Payment |
| Renewal date | READY_WITH_LIMITATIONS | `expiresAt` |
| Last login | READY_WITH_LIMITATIONS | `User.lastLogin` / USER_LOGIN facts |
| Unique-user DAU/WAU/MAU | UNAVAILABLE | Not instrumented |
| Feature adoption / breadth | UNAVAILABLE | FEATURE_USED not emitted |
| MRA EIS entitlement | READY_WITH_LIMITATIONS | `MraEisTenantEntitlement` |
| Support summary | NOT_INSTRUMENTED | No SupportTicket |
| Onboarding / training summary | NOT_INSTRUMENTED | No CS workflow models |
| Industry / region / acquisition | NOT_SUPPORTED | Attributes unverified |
| Portfolio / CS owner | READY after Wave 3 | New models |
| Risk/opportunity signals | READY_WITH_LIMITATIONS after Wave 4 | Verified dims only |
| Opaque health score | FORBIDDEN | Phase 8+ if governed |

**UI rule:** Only READY* show numbers; else UNAVAILABLE / Not instrumented with reason.
