# Current Pipeline Stage Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Pipeline stage catalogue | NOT_FOUND | No `CrmPipelineStage` |
| Stage entry / exit criteria | NOT_FOUND | — |
| Stage default probability | NOT_FOUND | — |
| NEW_BUSINESS Pipeline seed | NOT_FOUND | Design locks ACTIVE `NEW_BUSINESS` first |
| EXPANSION / MRA_EIS Pipelines | NOT_FOUND | In-phase later waves |
| Lead status machine as Pipeline stages | WRONG_DOMAIN | CrmLead statuses ≠ Opportunity stages |
| Analytics pipeline stages | WRONG_DOMAIN | Dispatch/consume/reconcile ops |

**Implication:** Wave 1 defines versioned stages on NEW_BUSINESS with entry/exit + default probability. Lead lifecycle remains separate.
