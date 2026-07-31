# Current Adoption ← Phase 8 Reconcile Audit

**Audited:** 2026-07-31

| Asset | Path | Class |
|-------|------|-------|
| `CsSuccessPlan` / `CsSuccessGoal` | `prisma/schema.prisma` (~11197–11219) | REUSE_WITH_RECONCILIATION — no `adoptionPlanId` yet |
| `CsPlaybook` / `CsPlaybookExecution` | `prisma/schema.prisma` (~11155–11172) | REUSE_WITH_RECONCILIATION |
| `CsIntervention` | `prisma/schema.prisma` (~11109) | REUSE_WITH_RECONCILIATION |
| `CsExpansionHandoff` | `prisma/schema.prisma` (~11236) | REUSE_WITH_RECONCILIATION — CS expansion; Adoption may add distinct handoff entity |
| `CsTrainingRecord` | Phase 8 + Phase 18 migrate | WRONG_DOMAIN as Adoption Plan truth |
| `CsOnboardingRecord` | Phase 8 | WRONG_DOMAIN as Adoption Plan truth |
| Plans service | `lib/admin/customerSuccess/plans.js` | CORRECT_AND_REUSABLE — `createSuccessPlan`, `listSuccessPlans`, `addSuccessGoal`; no invented progress % |
| Playbooks service | `lib/admin/customerSuccess/playbooks.js` | CORRECT_AND_REUSABLE — execute → CsTask steps |
| Interventions service | `lib/admin/customerSuccess/interventions.js` | CORRECT_AND_REUSABLE — `logIntervention`, `listInterventions` |
| Foundations | `lib/admin/customerSuccess/foundations.js` | CORRECT_AND_REUSABLE honesty pattern — UNKNOWN / NOT_INSTRUMENTED |
| Authz | `lib/admin/customerSuccess/authz.js` | CORRECT_AND_REUSABLE portfolio fail-closed |
| Rebuild intervention engine in Adoption | FORBIDDEN | Link + attest only |
| Historical Success Plan COMPLETED → Adoption Plan COMPLETED | FORBIDDEN | Requires linked Plan evidence |

**Implication:** Waves 3–4 store foreign ids and/or add optional `adoptionPlanId`; unresolved legacy → UNKNOWN; never invent Plan COMPLETED from Phase 8 checklist rows.
