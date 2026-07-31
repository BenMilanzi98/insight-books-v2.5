# Current Feature Catalogue Audit

| Source | Class | Evidence |
|--------|-------|----------|
| Canonical Feature codes for Product Analytics | NOT_FOUND | — |
| Storefront feature bullets | PAGE_VIEW_ONLY / marketing | `lib/subscriptionConfig.js` CORE/EIS storefront lists — not stable codes |
| `PlatformFeatureEntitlement.featureCode` | EXTEND | Free-form tenant overrides; not a governed catalogue |
| `PlatformPlanVersion.featuresJson` | REUSE_WITH_RECONCILIATION | Plan-version features blob — must version historically |
| Admin `DEFAULT_FEATURE_FLAGS` | WRONG_SCOPE | Ops flags in `platformSettings.js`, not product modules |

**Disposition:** Wave 1 defines stable Feature codes (e.g. `invoices.post`, `sales.pos.complete`, `eis.fiscal.accept`) with lifecycle + cadence. Do not use display labels alone.
