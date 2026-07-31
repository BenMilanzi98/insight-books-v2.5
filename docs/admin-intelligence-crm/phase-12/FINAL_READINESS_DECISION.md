# Final Readiness Decision — Enter Phase 12 Wave 1

**Decision:** CONDITIONAL GO (Wave 1)

**Date:** 2026-07-30

## Rationale

Phase 11 exited `READY_FOR_PHASE_12_WITH_BLOCKERS`. Forensic Wave 0 confirms there is **no** CrmOpportunity / CrmPipeline plane today: `/insightbooks/crm/pipeline` and `/insightbooks/crm/opportunities` are NOT_FOUND; Prisma has no Opportunity/Pipeline models; Kanban/win-loss/competitor/deal probability fields are NOT_FOUND; foundations `OPPORTUNITY_PIPELINE` remains `NOT_AVAILABLE`; pipeline permission keys are scaffold-only with no `opportunity.*` keys. Phase 11 **does** supply a READY create input: `evaluateOpportunityReadiness` → `CRM_OPPORTUNITY_HANDOFF` (idempotency key; `opportunityId` always null; never creates Opportunity). `/insightbooks/analytics-pipeline` is WRONG_DOMAIN (ops health). Locked design (NEW_BUSINESS first; extend `lib/admin/crm/*`; weighted UI dark until Phase 16; import+reports+schedules in-phase) is approved and unblocked for greenfield Wave 1.

## Conditions

1. Opportunity ≠ Lead ≠ Customer ≠ Subscription ≠ Proposal ≠ Quotation ≠ Invoice — enforced in models, APIs, and UI copy.
2. Opportunity value ≠ Phase 6 Revenue / MRR / ARR; currency explicit; no silent FX.
3. Create only from READY `CRM_OPPORTUNITY_HANDOFF` (idempotent); unqualified Leads blocked.
4. Stage transitions server-authorised; drag-and-drop never persists without server OK; history immutable.
5. Probability explainable/versioned/confidence — not ML; not Lead score; not Revenue certainty.
6. Closed Won requires evidence; does **not** provision Tenant / Subscription / Invoice / Payment.
7. Weighted Pipeline calculation may exist; **UI/reports disabled** until Phase 16.
8. analytics-pipeline and Tenant POS `sales.*` must never authorize or alias Sales Pipeline.
9. No fabricated amounts / close dates / competitors / win-loss; reliability gates never return fabricated numeric zeroes.
10. No Tenant GL / payment secrets / MRA credentials on Opportunity records; CoA admin route stays removed.
11. Expected phase exit: **READY_FOR_PHASE_13_WITH_BLOCKERS** (weighted UI + optional competitor/partner/legacy may remain blockers).

## Wave 0 completion checklist

- [x] Input validation vs Phase 11 handoff + READY exit  
- [x] CURRENT_* audits (architecture through export)  
- [x] Quality / recon / privacy / security / performance audits  
- [x] Source / version / transition / domain / product / commercial / currency / probability / close-date / role / risk / proposal / conversion / reliability / security matrices  
- [x] Gap register + implementation plan pointer  
- [x] This decision recorded — **CONDITIONAL GO**  

**Next:** User chooses **Subagent-Driven** or **Inline** execution for Waves 1–4.  
**Skip:** `PHASE_13_READINESS_CHECKLIST.md` until Wave 4.
