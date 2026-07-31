# Entitlement Matrix

| Entitlement type | Source | Historical? | Analytics may mutate? |
|------------------|--------|-------------|------------------------|
| Plan included features | `PlatformPlanVersion.featuresJson` | Yes — pin version | No |
| Usage / user / business / branch limits | `limitsJson` | Yes | No (observe only) |
| Tenant feature override | `PlatformFeatureEntitlement` | Effective dates | No |
| MRA EIS entitlement | `MraEisTenantEntitlement` | isCurrent + window | No |
| Storefront marketing bullets | `subscriptionConfig` | No | Ignore for analytics |
| Grandfather / custom | Overrides + contract notes | Required | No |

**Statuses for utilisation:** INCLUDED · OPTIONAL_ADD_ON · NOT_INCLUDED · GRANDFATHERED · CUSTOM_CONTRACT · UNKNOWN  

**Used-without-entitlement:** DQ incident only — analytics does not revoke access.
