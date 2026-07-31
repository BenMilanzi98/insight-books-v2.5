# MRA EIS Entitlement Audit

**Date:** 2026-07-28

## Canonical compliance model — KEEP

```
MraEisPlatformSetting → MraEisTenantEntitlement → Participation
  → BusinessSetting → Terminals / Credentials / Config / Mappings → Transmission
```

Key modules: `lib/mraEis/application/entitlementService.js`, `capabilityService.js`, `policies/effectiveCapability.js`.

## Relation to billing — DISCONNECTED

| Question | Finding |
|----------|---------|
| FK to AccountSubscription? | None |
| Payment grants entitlement? | No |
| Entitlement requires paid plan? | No |
| `hasEISAccess` reads entitlement? | No |
| `canSubmitEISInvoice` combines both? | Yes (billing then capability) |

`ENTITLEMENT_SOURCE.SUBSCRIPTION_PLAN` exists in constants but is unused.

## Capability gap — INCOMPLETE

`evaluateTenantEisCapability` still injects stub `futureRuntime` (all false), which can block transmit even when terminals/config exist. Domain readiness services often bypass this for their own checks — **ENTITLEMENT_RISK / INCOMPLETE**.

## Legacy paths — REIMPLEMENT / REFACTOR

| Asset | Classification |
|-------|----------------|
| `Tenant.eisEnabled` | REFACTOR — legacy gate |
| `EISConfiguration` plaintext secrets | REIMPLEMENT / quarantine |
| `/api/eis/**` + `lib/eisService.js` | REFACTOR — bypasses MraEis entitlement |
| Admin centre → `/api/mra-eis/admin` | DISCONNECTED — wrong auth plane |

## Permissions — ENTITLEMENT_RISK

UI/nav uses `systemAdmin.mraEntitlement.*` while APIs use `system.eis.entitlement.*`. Non–Super Admin roles may disagree between UI and API.

## Target rules (locked 2026-07-28)

1. **Subscription first:** payment activates commercial MRA EIS subscription; entitlement remains pending until admin review  
2. Compliance entitlement required for opt-in / setup / fiscalization (payment alone is not readiness)  
3. Billing subscription required for commercial access / quota  
4. Feature entitlements never encode MRA compliance  
5. Show both statuses in admin + tenant UIs 
