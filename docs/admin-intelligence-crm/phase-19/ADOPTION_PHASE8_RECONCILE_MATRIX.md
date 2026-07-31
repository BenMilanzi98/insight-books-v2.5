# Adoption Phase 8 Reconcile Matrix

| Phase 8 asset | Path | Adoption link | Current | Class | Wave |
|---------------|------|---------------|---------|-------|------|
| Success Plan | `plans.js` / `CsSuccessPlan` | Optional `adoptionPlanId` or Plan.successPlanId | No link field | UNRECONCILED | 3–4 |
| Success Goal | `CsSuccessGoal` | Evidence / display only | No Adoption link | REUSE_WITH_RECONCILIATION | 4 |
| Playbook | `playbooks.js` / `CsPlaybook` | Champion / dormancy / milestone tasks | No Adoption link | REUSE_WITH_RECONCILIATION | 3 |
| Playbook execution | `CsPlaybookExecution` | Store execution id | No Adoption link | REUSE_WITH_RECONCILIATION | 3 |
| Intervention | `interventions.js` / `CsIntervention` | `linkPhase8Intervention` | No Adoption link | REUSE_WITH_RECONCILIATION | 3 |
| Expansion handoff | `handoffs.js` / `CsExpansionHandoff` | May reference; Adoption entity distinct | READY CS side | REUSE_WITH_RECONCILIATION | 3 |
| Training record | `CsTrainingRecord` | Wrong spine | Phase 18 migrate | WRONG_DOMAIN | — |
| Onboarding record | `CsOnboardingRecord` | Wrong spine | Foundations | WRONG_DOMAIN | — |
| Historical COMPLETED without Plan link | — | UNKNOWN | — | FORBIDDEN invent COMPLETED | 4 |
| Rebuild engines | — | Forbidden | — | FORBIDDEN | All |
