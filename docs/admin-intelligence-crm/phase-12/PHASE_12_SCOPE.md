# Phase 12 Scope

## In scope (core waves)

1. Versioned Sales Pipeline catalogue — ACTIVE `NEW_BUSINESS` first; EXPANSION / MRA_EIS later in-phase
2. Pipeline stages with entry/exit criteria + stage default probability
3. Server-authorised stage transition service + immutable stage history (board drag never persists alone)
4. `CrmOpportunity` with `OPP-YYYY-######` numbering
5. Create Opportunity from Phase 11 READY `CRM_OPPORTUNITY_HANDOFF` only (idempotent; never invent from unqualified Lead)
6. Lead status bridge to `CONVERTED_TO_OPPORTUNITY` when create succeeds
7. Contact roles on Opportunity (Account/Contact preserved from handoff)
8. Opportunity products + non-binding commercial estimates (amount basis + currency + amount history)
9. Explainable probability (stage default + override + confidence) — not ML; not Revenue certainty
10. Close-date provenance + confidence + history
11. Board / list / My Pipeline UI under `/insightbooks/crm/pipeline` + `/insightbooks/crm/opportunities`
12. Opportunity risks / tasks / timeline (CRM plane; ≠ Support/CS threads)
13. Win/loss with Closed Won evidence requirements (no Tenant/Subscription/Invoice provision)
14. Proposal readiness + conversion readiness handoff payloads (record-only; Phase 13+ consumers)
15. Duplicate Opportunity detection + controlled merge
16. Full Opportunity import + Pipeline reporting centre + scheduled Pipeline reports (honesty gates)
17. Weighted Pipeline calculation service implemented but **UI/report flag OFF** until Phase 16
18. Phase 13 pack at Wave 4 exit

## Explicitly deferred / NOT_AVAILABLE

| Item | Disposition |
|------|-------------|
| Weighted Pipeline UI / reports | Dark until Phase 16 |
| Email → Lead ingest | Phase 11 contract — orthogonal; never invent channel volume |
| WhatsApp → Lead ingest | Same |
| Optional competitor intelligence depth | May remain deferred → exit WITH_BLOCKERS |
| Partner / legacy Opportunity sources | May remain deferred |
| Tenant / Subscription / Invoice create from Closed Won | Forbidden |
| Phase 6 Revenue / MRR / ARR mixing | Forbidden |
| Silent FX conversion | Forbidden |
| AI / ML win probability | Forbidden |
| CoA admin route revival | Forbidden (stays removed) |
| Analytics pipeline (`/insightbooks/analytics-pipeline`) as Sales Pipeline | WRONG_DOMAIN |

## Exit expectation

**READY_FOR_PHASE_13_WITH_BLOCKERS** when NEW_BUSINESS Pipeline + Opportunity create-from-READY + transitions + commercial/probability/close-date + board/win-loss + import/reports are trustworthy, and weighted UI / optional competitor/partner/legacy sources remain explicit blockers.
