# Current Pipeline Architecture Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| `/insightbooks/crm/pipeline` | NOT_FOUND | No app route under CRM pipeline |
| `/insightbooks/crm/opportunities` | NOT_FOUND | No opportunities route tree |
| `CrmPipeline` / `CrmPipelineStage` Prisma | NOT_FOUND | `schema.prisma` Crm* ends at Lead/merge/export — no Pipeline models |
| `CrmOpportunity` Prisma | NOT_FOUND | No Opportunity model |
| `lib/admin/crm/*` CRM domain | CORRECT_AND_REUSABLE | Phase 11 plane — extend; do not fork POS/Revenue |
| Opportunity readiness | READY (handoff only) | `opportunityReadiness.js` → `CRM_OPPORTUNITY_HANDOFF`; never creates Opportunity |
| Foundations OPPORTUNITY_PIPELINE | NOT_AVAILABLE | `foundations.js` contract; `deferredTo: 'Phase 12'` |
| Pipeline permission keys | PARTIAL | `systemAdmin.crm.pipeline.view` / `.manage` scaffold; no Opportunity UI |
| `opportunity.*` permission keys | NOT_FOUND | — |
| `/insightbooks/analytics-pipeline` | WRONG_DOMAIN | Health/dispatch/consume/reconcile/backfill — ops analytics, not Sales Pipeline |
| Tenant POS `sales.*` | WRONG_DOMAIN / FORBIDDEN | Never authorize platform Pipeline |
| Phase 6 Revenue / MRR / ARR | WRONG_DOMAIN / FORBIDDEN as Pipeline value | Boundary only |
| Competing Sales Pipeline systems | NOT_FOUND | Greenfield Opportunity plane |

**Implication:** Build versioned Sales Pipeline under extended `lib/admin/crm/*` + `CrmPipeline*` / `CrmOpportunity*`. Never alias analytics-pipeline, POS sales, or Phase 6 Revenue as CRM Pipeline.
