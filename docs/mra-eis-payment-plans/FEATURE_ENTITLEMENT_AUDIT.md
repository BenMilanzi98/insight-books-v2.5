# Feature Entitlement Audit

**Date:** 2026-07-28

| Store | Purpose | Classification |
|-------|---------|----------------|
| `PlatformFeatureEntitlement` + `/insightbooks/feature-entitlements` | Generic platform feature flags | KEEP for non-EIS; ENTITLEMENT_RISK if used for MRA |
| Plan `features` strings in subscriptionConfig | Marketing/feature lists | EXTEND → controlled feature codes |
| MRA EIS operational features | Capability / readiness services | KEEP — separate from commercial feature catalogue |

## Rule

Never use `PlatformFeatureEntitlement` as MRA EIS compliance entitlement.  
Commercial plan features must be validated in APIs/workers, not UI-only.
