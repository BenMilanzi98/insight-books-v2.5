# Training Source Matrix

| Source | Creates Request? | Class | Evidence / notes |
|--------|------------------|-------|------------------|
| `PHASE_16_TRAINING_HANDOFF` | Yes (auto, idempotent) | CORRECT_AND_REUSABLE | `createTrainingHandoff` → Wave 1 `consumeTrainingHandoff` |
| `PHASE_17_ONBOARDING_REQUIREMENT` | Yes (link coordination) | CORRECT_AND_REUSABLE / EXTEND | `CustomerOnboardingTraining` — coordination ≠ Program complete |
| `CUSTOMER_SUCCESS_REQUEST` | Manual/approved | EXTEND | CS case ≠ auto Program |
| `SUPPORT_RECOMMENDATION` | Manual/approved | EXTEND | Support ticket ≠ Training Request auto |
| `PRODUCT_ADOPTION_INTERVENTION` | Manual/approved | EXTEND | Phase 19 foreshadow — gated |
| `CUSTOMER_REQUEST` | Manual/approved | EXTEND | — |
| `PLAN_UPGRADE` / `ADD_ON_ACTIVATION` | Manual/approved | EXTEND | Requires commercial/subscription truth |
| `NEW_USER_REQUEST` / `REFRESHER_REQUEST` | Manual/approved | EXTEND | — |
| `MRA_EIS_REQUEST` | Manual/approved | EXTEND | Training scope only — no fiscal |
| `MANUAL_APPROVED` | Yes | EXTEND | Wave 1+ |
| `LEGACY_MIGRATION` | Controlled | REUSE_WITH_RECONCILIATION | Phase 8 `CsTrainingRecord` — Wave 4 link/UNKNOWN |
| `API` | Future | NOT_AVAILABLE | — |
| `OTHER` | Gated | EXTEND | — |
| Conversion ONBOARDING/MIGRATION/MRA handoffs | No (distinct planes) | CORRECT_AND_REUSABLE | Do not create TRAINING Request from wrong handoff type |
| Onboarding completion certificate | No | WRONG_DOMAIN | ≠ Training complete |
