# Phase 12 — Sales Pipeline & Opportunity Management

**Surface:** `/insightbooks/crm/pipeline`, `/insightbooks/crm/opportunities`  
**Architecture:** Extend `lib/admin/crm/*` + `CrmPipeline*` / `CrmOpportunity*` (Lead ≠ Opportunity ≠ Customer ≠ Subscription ≠ Proposal ≠ Invoice)  
**Design:** `docs/superpowers/specs/2026-07-30-sales-pipeline-phase-12-design.md`  
**Plan:** `docs/superpowers/plans/2026-07-30-sales-pipeline-phase-12.md`  
**Handoff in:** `docs/admin-intelligence-crm/phase-11/PHASE_12_INPUTS.md`  
**Phase 11 exit:** `READY_FOR_PHASE_12_WITH_BLOCKERS`

## Wave status

| Wave | Focus | Status |
|------|-------|--------|
| 0 | Forensic audits + matrices + CONDITIONAL GO | Complete (2026-07-30) |
| 1 | NEW_BUSINESS Pipeline + stages + transition service; Opportunity + numbering; READY handoff create | Pending |
| 2 | Contact roles; products/commercial; probability + close dates | Pending |
| 3 | Board/list/My Pipeline; risks/tasks/timeline; win/loss; proposal/conversion readiness | Pending |
| 4 | Extra Pipelines; duplicates/merge; import; reports + schedules; Phase 13 pack | Pending |

**Phase exit (expected):** `READY_FOR_PHASE_13_WITH_BLOCKERS`  
**Skip until Wave 4:** `PHASE_13_READINESS_CHECKLIST.md`

## Hard rules

- Opportunity ≠ Lead ≠ Customer ≠ Subscription ≠ Proposal ≠ Quotation ≠ Invoice
- Opportunity value ≠ contracted/billed/recognised Revenue; ≠ Phase 6 MRR/ARR
- Stage transitions server-authorised; drag-and-drop never persists without server OK; stage history immutable
- Probability explainable, versioned, confidence-visible — not ML; not Revenue certainty
- Currency explicit; no silent FX conversion
- Closed Won requires evidence; does **not** provision Tenant / Subscription / Invoice / Payment
- Create from Phase 11 READY `CRM_OPPORTUNITY_HANDOFF` only (idempotent); unqualified Leads blocked
- Weighted Pipeline calculation service may exist; **UI/reports disabled** until Phase 16
- No fabricated amounts / close dates / competitors / win-loss; no false zeroes
- CoA admin route stays removed; no Tenant GL / payment / MRA secret exposure
- `/insightbooks/analytics-pipeline` is WRONG_DOMAIN (health/ops) — never alias as Sales Pipeline

## Classification legend

| Class | Meaning |
|-------|---------|
| READY | Usable as-designed for Phase 12 consumption |
| PARTIAL | Exists but incomplete / not Opportunity-shaped |
| NOT_FOUND | Absent in codebase / schema |
| WRONG_DOMAIN | Exists but belongs to another plane |
| NOT_AVAILABLE | Explicitly deferred with contract |
| BLOCKED | Cannot proceed until dependency cleared |
| CORRECT_AND_REUSABLE | Keep as boundary / input; do not redefine |
| FORBIDDEN | Must not be reused as Pipeline / Opportunity truth |
