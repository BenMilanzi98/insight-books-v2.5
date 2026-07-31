# Current Entitlement Provisioning Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Feature entitlement helpers | FOUNDATION | `lib/admin/featureEntitlements.js` |
| Product catalogue entitlements | FOUNDATION | `lib/admin/productCatalogue/entitlements.js` |
| PlatformPlanVersion features/limits | FOUNDATION | Plan taxonomy |
| MRA EIS entitlementService | WRONG_DOMAIN / REUSE_WITH_RECONCILIATION | Fiscal product plane |
| Qty ≤ accepted enforcement | NOT_FOUND | — |
| Hidden/unquoted feature grant | FORBIDDEN / NOT_FOUND | Must stay forbidden |
| PROVISION_ENTITLEMENTS | NOT_FOUND | — |

**Implication:** Wave 3 map accepted line items → capped grants; no silent feature unlock.
