# Product Source Matrix

| Metric family | Authoritative source (required) | Candidate only (not live) | Class today |
|---------------|----------------------------------|---------------------------|-------------|
| Product Event | AnalyticsEvent via outbox | — | Plane READY; product codes NOT_INSTRUMENTED |
| Invoice first value | Producer on posted invoice | Invoice/Sale rows | NOT_INSTRUMENTED |
| POS first value | Producer on completed POS | POS/Sale rows | NOT_INSTRUMENTED |
| MRA first value | Producer on accepted fiscal | MraEisFiscalReceipt / accepted transmission | NOT_INSTRUMENTED |
| Engagement login | User.lastLogin | — | READY_WITH_LIMITATIONS (not Product DAU) |
| Entitlement | PlatformPlanVersion + overrides + MraEisTenantEntitlement | — | READY_WITH_LIMITATIONS |
| Android product value | Future Android meaningful emit | MobileAppClientEvent (updates only) | NOT_INSTRUMENTED |
| Page views | — | Route loads | FORBIDDEN as value |
| Tenant Sale / GL | — | — | FORBIDDEN |

**UI rule:** Only READY* after producers + facts may show numbers; else NOT_INSTRUMENTED / UNAVAILABLE with reason — never 0.
