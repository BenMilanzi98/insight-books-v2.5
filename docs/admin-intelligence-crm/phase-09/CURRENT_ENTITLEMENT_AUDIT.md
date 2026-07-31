# Current Entitlement Audit

| Model / helper | Class | Notes |
|----------------|-------|-------|
| `AccountSubscription` | READY_WITH_LIMITATIONS | Tenant plan status/dates — commercial not feature matrix |
| `PlatformPlanVersion` | CORRECT_AND_REUSABLE | `featuresJson`, `limitsJson`, historical versions |
| `PlatformFeatureEntitlement` | EXTEND | Tenant overrides with dates/status |
| `MraEisTenantEntitlement` | CORRECT_AND_REUSABLE | EIS commercial/ops entitlement (not fiscal value) |
| `lib/admin/featureEntitlements.js` | EXTEND | Admin API helpers |
| Historical plan resolution for analytics | INCOMPLETE | Must not use current public plan for historical customers |

**Rules for Phase 9:** Analytics never grants/revokes entitlement. Usage outside entitlement → Data Quality incident only.
