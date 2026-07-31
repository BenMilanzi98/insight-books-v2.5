# Adoption Source Matrix

| Source | Creates Request? | Class | Evidence / notes |
|--------|------------------|-------|------------------|
| `PHASE_18_TRAINING_COMPLETED` | Yes (auto, idempotent) — aggregate `COMPLETED` only | CORRECT_AND_REUSABLE | `training/completion.js` |
| `PHASE_18_TRAINING_COMPLETED_WITH_GAPS` | No | FORBIDDEN auto | Partial / WITH_GAPS ≠ ADR |
| `PHASE_17_ONBOARDING_HANDOVER` | Attach (may create/link Request with human path) | CORRECT_AND_REUSABLE | `onboarding/handover.js` — never invents Training COMPLETED |
| `CUSTOMER_SUCCESS_MANUAL` | Yes (manual) | EXTEND | Wave 1 |
| `SUPPORT_RECOMMENDATION` | Manual/approved | EXTEND | Support ≠ auto Plan COMPLETED |
| `PRODUCT_SIGNAL` | Manual/approved / gated | EXTEND | Phase 9 signal informs; not auto MET |
| `DORMANCY_RECOVERY` | Gated | EXTEND | Wave 3 |
| `EXPANSION_SIGNAL` | Gated | EXTEND | Wave 3 |
| `PLAN_UPGRADE` / `ADD_ON_ACTIVATION` | Manual/approved | EXTEND | Requires commercial truth pins |
| `LEGACY_MIGRATION` | Controlled | REUSE_WITH_RECONCILIATION | Phase 8 Success Plan link Wave 4 |
| `API` | Future | NOT_AVAILABLE | — |
| `OTHER` | Gated | EXTEND | — |
| Intelligence stub / CRM FEATURE_USED pack | No | WRONG_SOURCE | Must not seed Request as COMPLETED truth |
| Onboarding Project COMPLETED alone | No auto Plan COMPLETED | WRONG_DOMAIN | Attach only |
| Phase 8 Success Plan COMPLETED alone | No | FORBIDDEN | Without linked Adoption Plan evidence |
