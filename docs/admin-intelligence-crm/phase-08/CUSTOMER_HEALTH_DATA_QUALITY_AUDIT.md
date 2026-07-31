# Customer Health Data Quality Audit

## Source quality for v1 scored dimensions

| Dimension | Source quality | Risks | Mitigation |
|-----------|----------------|-------|------------|
| Commercial | Platform invoices/payments + subscription | Multi-sub ambiguity; FX UNAVAILABLE (Phase 6) | Use Phase 7 commercial helper; limitations in drivers |
| Engagement | `User.lastLogin` max + active proxy count | Login ≠ product usage; no FEATURE_USED | Label login proxy; never claim DAU |
| MRA EIS | `MraEisTenantEntitlement` current | Non-EIS tenants | Dim NOT_APPLICABLE when entitlement N/A → renormalise |
| Relationship | Active `CustomerOwnership` + open signals | Ephemeral signals if Prisma model locked | Prefer persisted `CustomerSignal`; document ephemeral limitation |

## Quality rules for scoring

1. Query failure → dimension FAILED → overall confidence INSUFFICIENT or score null (never treat as 0).
2. Missing/inapplicable → NOT_APPLICABLE → exclude + renormalise weights.
3. Insufficient eligible dims (e.g. &lt; 2 scored) → band UNKNOWN, score null.
4. Snapshot stores inputs hash + definition version for rebuild/compare.

## Known data gaps (not defects of Health)

Adoption, support, onboarding, training, NPS — out of v1 eligible set.
