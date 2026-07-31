# Onboarding Source Matrix

| Source | Creates Request? | Class | Evidence / notes |
|--------|------------------|-------|------------------|
| `PHASE_16_ONBOARDING_HANDOFF` | Yes (auto, idempotent) | CORRECT_AND_REUSABLE | `createOnboardingHandoff` → Wave 1 `consumeOnboardingHandoff` |
| `EXISTING_CUSTOMER_EXPANSION` | Manual/approved | REUSE_WITH_RECONCILIATION | CS expansion handoff WRONG_DOMAIN as auto seed; may MANUAL_APPROVED |
| `PLAN_UPGRADE` | Manual/approved | EXTEND | Requires commercial/subscription truth |
| `ADD_ON_ACTIVATION` | Manual/approved | EXTEND | — |
| `CUSTOMER_SUCCESS_REQUEST` | Manual/approved | EXTEND | CS case ≠ auto Project |
| `MANUAL_APPROVED` | Yes | EXTEND | Wave 1+ |
| `LEGACY_MIGRATION` | Controlled | REUSE_WITH_RECONCILIATION | Phase 8 rows — Wave 4 link/UNKNOWN |
| `API` | Future | NOT_AVAILABLE | — |
| `OTHER` | Gated | EXTEND | — |
| Conversion TRAINING/MIGRATION/MRA handoffs | No (distinct planes) | CORRECT_AND_REUSABLE | Do not create ONBOARDING Request from wrong handoff type |
| Conversion completion certificate | No | WRONG_DOMAIN | ≠ onboarding complete |
