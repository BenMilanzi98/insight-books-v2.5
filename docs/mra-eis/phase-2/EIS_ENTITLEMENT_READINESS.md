# EIS Entitlement Readiness

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

## Existing

- Plans: `eis-monthly`, `eis-yearly` (`lib/subscriptionConfig.js`)
- `hasEISAccess`, `canSubmitEISInvoice`, `Tenant.eisEnabled`
- Admin `/api/admin/eis-subscriptions`

## Target formula (Phase 1/3)

`Platform AND Admin entitlement AND Tenant ops AND Config complete AND Active terminal AND Config fresh AND Not blocked`

## Gaps

| Gap | Severity |
|---|---|
| hasEISAccess may pick non-EIS plan first | BLOCKER |
| No platform kill-switch distinct from subscription | HIGH |
| No dedicated eis.* permissions | HIGH |
| SHOW_EIS_SUBSCRIPTION_UI = false | LOW |
| Terminal/block/config completeness not in entitlement | HIGH |

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
