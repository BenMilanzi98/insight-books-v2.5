# Phase 12 Input Validation

**Date:** 2026-07-30  
**Source readiness:** Phase 11 `READY_FOR_PHASE_12_WITH_BLOCKERS`

## Required inputs

| Input | Evidence | Status |
|-------|----------|--------|
| Phase 11 handoff pack | `phase-11/PHASE_12_INPUTS.md` | PASS |
| Phase 11 final report exit | `READY_FOR_PHASE_12_WITH_BLOCKERS` | PASS |
| Design approval | `docs/superpowers/specs/2026-07-30-sales-pipeline-phase-12-design.md` | PASS |
| Implementation plan | `docs/superpowers/plans/2026-07-30-sales-pipeline-phase-12.md` | PASS |
| Opportunity readiness service | `lib/admin/crm/opportunityReadiness.js` → `evaluateOpportunityReadiness` | PASS (READY payload; never creates Opportunity) |
| Handoff type | `handoffPayload.type === 'CRM_OPPORTUNITY_HANDOFF'` | PASS |
| Idempotency key | `opp-ready:{leadId}:{qualVersion}:{scoreVersion}` | PASS |
| Explicit honesty fields | `opportunityId: null`, `opportunityCreated: false`, `pipelineCreated: false`, `isProbability: false` | PASS |
| Foundations OPPORTUNITY_PIPELINE | `lib/admin/crm/foundations.js` → `NOT_AVAILABLE` | PASS (contract; deferred to Phase 12) |
| CrmLead / CrmAccount / CrmContact | `schema.prisma` Crm* models (Phase 11) | PASS (link targets; ≠ Opportunity) |
| CRM permissions live category | Phase 11 `systemAdmin.crm.*` | PASS (Lead/Account/Contact plane) |
| Pipeline view/manage scaffold | `systemAdmin.crm.pipeline.view` / `.manage` in `lib/admin/permissions.js` | PARTIAL (scaffold; no Opportunity UI) |
| `opportunity.*` permission keys | permissions search | FAIL / NOT_FOUND |
| CrmOpportunity / CrmPipeline Prisma | `schema.prisma` | FAIL / NOT_FOUND |
| `/insightbooks/crm/pipeline` | App tree | FAIL / NOT_FOUND |
| `/insightbooks/crm/opportunities` | App tree | FAIL / NOT_FOUND |
| Kanban / win-loss / competitor / deal probability fields | Schema + CRM modules | FAIL / NOT_FOUND |
| Analytics pipeline route | `/insightbooks/analytics-pipeline` + health APIs | WRONG_DOMAIN (ops health; not Sales Pipeline) |
| Phase 6 Revenue / MRR | Revenue plane | CORRECT_AND_REUSABLE as boundary — FORBIDDEN as Opportunity value |
| Metric envelopes / AdminShell | Phases 2–3 | PASS |
| Export safety helpers | `exportSafety.preventFormulaInjection` | PASS (reuse) |
| Email / WhatsApp Lead ingest | Foundations | NOT_AVAILABLE (carry; do not invent volume) |

## Blockers carried in

| Blocker | Treatment |
|---------|-----------|
| No CrmOpportunity / CrmPipeline plane | Wave 1 creates under `lib/admin/crm/*` |
| Foundations OPPORTUNITY_PIPELINE NOT_AVAILABLE | Wave 1+ replace with live Pipeline; keep honesty until shipped |
| Pipeline permissions scaffold only | Wave 1 live authz + nav; add `opportunity.*` keys |
| No opportunity create consumer for READY handoff | Wave 1 idempotent create |
| analytics-pipeline looks like “pipeline” | WRONG_DOMAIN — never alias |
| Score ≠ probability | Preserve; Phase 12 probability is separate explainable model |
| Email/WhatsApp Lead ingest | Orthogonal NOT_AVAILABLE — do not invent funnel volume |
| Full import / reporting FOUNDATION | In-scope for Phase 12 Waves 3–4 with honesty gates |
| Owner/team/territory list scope stub | Carry harden; Pipeline inherits CRM scope patterns |
| Weighted Pipeline UI | Explicitly dark until Phase 16 |

## Decision for Wave 1 entry

**CONDITIONAL GO** — Phase 11 READY handoff, CrmLead/Account/Contact plane, foundations contract, and approved design are sufficient to build greenfield CrmPipeline (NEW_BUSINESS) + CrmOpportunity create-from-READY. Opportunity UI, commercial/probability/close-date, win/loss, import/reports follow Waves 2–4; weighted UI stays dark until Phase 16.
