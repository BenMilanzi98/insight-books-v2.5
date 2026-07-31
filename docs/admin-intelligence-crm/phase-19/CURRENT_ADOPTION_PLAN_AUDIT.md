# Current Adoption Plan Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| `CustomerAdoptionPlan` model | NOT_FOUND | Absent from schema |
| ADP numbering | NOT_FOUND | — |
| Plan template / templateVersion | NOT_FOUND | — |
| `createCustomerAdoptionPlan` | NOT_FOUND | — |
| Plan status machine + completion policy | NOT_FOUND | — |
| Phase 8 Success Plan as Plan substitute | WRONG_DOMAIN / REUSE_WITH_RECONCILIATION | `CsSuccessPlan` may link; is not Adoption Plan |
| One Request → one Plan | NOT_FOUND | Wave 1 concurrency-safe convert |
| Ungated FSM → COMPLETED | FORBIDDEN | Requires Wave 2 `evaluateAdoptionPlanCompletion` |

**Implication:** Wave 1 creates Plan + pin templateVersion; COMPLETED / HANDED_TO_RENEWALS blocked until evaluation hooks (`COMPLETION_POLICY_REQUIRED`) or Wave 2 wires evaluation.
