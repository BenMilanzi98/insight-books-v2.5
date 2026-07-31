# Sales Pipeline & Opportunity Management Phase 12 — Design

**Status:** Approved (conversation 2026-07-30); Wave 0 first  
**Date:** 2026-07-30  
**Surface:** `/insightbooks/crm/pipeline`, `/insightbooks/crm/opportunities`  
**Architecture:** Extend `lib/admin/crm/*` + `CrmPipeline*` / `CrmOpportunity*` (Lead ≠ Opportunity)

---

## 1. Purpose

Deliver one authoritative, versioned Sales Pipeline and Opportunity plane for InsightBooks platform Sales: governed stage transitions, non-binding commercial estimates, explainable probability, close-date provenance, win/loss, and proposal/conversion readiness handoffs — without provisioning Tenants, creating Subscriptions/Invoices, or mixing Pipeline value with Phase 6 Revenue.

---

## 2. Locked decisions

| Topic | Decision |
|-------|----------|
| Sequencing | Wave 0 forensic audits + matrices before code |
| Ops depth | Core + full import + reporting centre + scheduled Pipeline reports |
| Weighted Pipeline | Calculation service implemented; **UI/reports disabled** until Phase 16 |
| Pipeline catalogue | ACTIVE `NEW_BUSINESS` first; EXPANSION / MRA_EIS later in-phase |
| Domain | Extend CRM (`lib/admin/crm/*`), not POS / separate plane |
| Exit | `READY_FOR_PHASE_13_WITH_BLOCKERS` if optional competitor/partner/legacy sources remain deferred |

---

## 3. Hard rules

- Opportunity ≠ Lead ≠ Customer ≠ Subscription ≠ Proposal ≠ Quotation ≠ Invoice.
- Opportunity value ≠ contracted/billed/recognised Revenue; ≠ Phase 6 MRR/ARR.
- Stage transitions server-authorised; drag-and-drop never persists without server OK; stage history immutable.
- Probability explainable, versioned, confidence-visible — not ML; not Revenue certainty.
- Currency explicit; no silent FX conversion.
- Closed Won requires evidence; does not provision Tenant/Subscription/Invoice/Payment.
- Create from Phase 11 READY `CRM_OPPORTUNITY_HANDOFF` (idempotent); unqualified Leads blocked.
- No fabricated amounts/close dates/competitors/win-loss; no false zeroes.
- CoA admin route stays removed; no Tenant GL / payment / MRA secret exposure.
- Commits only when user asks.

---

## 4. Wave 0 — Forensic pack (docs only)

Create `docs/admin-intelligence-crm/phase-12/` with CURRENT_* audits, quality/recon/privacy/security/performance audits, matrices, gap register, IMPLEMENTATION_PLAN, CONDITIONAL GO for Wave 1.

---

## 5. Domain architecture (post–Wave 0)

```text
CrmPipeline (+ version) → CrmPipelineStage (+ entry/exit/probability)
CrmOpportunity (OPP-YYYY-######)
  ← Phase 11 CRM_OPPORTUNITY_HANDOFF (idempotent)
  → Account / Contacts / roles
  → Products + commercial estimates (non-binding)
  → Probability + close-date history
  → Stage transitions (immutable history)
  → Risks / tasks / timeline
  → Win/loss + proposal/conversion readiness handoffs
```

Consume: `evaluateOpportunityReadiness` → `handoffPayload` (`type: 'CRM_OPPORTUNITY_HANDOFF'`).

---

## 6. Waves after Wave 0

| Wave | Focus |
|------|--------|
| 0 | Audits + matrices + readiness |
| 1 | NEW_BUSINESS Pipeline + stages + transition service; Opportunity + numbering; READY handoff create |
| 2 | Contact roles; products/commercial; probability + close dates |
| 3 | Board/list/My Pipeline; risks/tasks/timeline; win/loss; proposal/conversion readiness |
| 4 | Extra Pipelines; duplicates/merge; import; reports + schedules; Phase 13 pack |

---

## 7. Approval

Conversational design **approved** 2026-07-30.
