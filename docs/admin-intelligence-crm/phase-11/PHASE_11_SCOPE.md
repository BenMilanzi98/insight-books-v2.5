# Phase 11 Scope

## In scope (core waves)

1. Canonical CRM domain under `/insightbooks/crm` — `CrmAccount`, `CrmContact`, `CrmLead`
2. Numbering (`ACC-…`, `CON-…`, `LEAD-YYYY-######`), status state machine + history
3. Manual create/list/get APIs + permissions / nav stubs
4. Public capture: wire `/contact` + add `/request-demo`, `/start-trial`, `/sales-enquiry` (shared capture service; distinct source codes)
5. CS / Support / Product handoff → Lead intake (read handoff records; create Lead — no source mutation of tickets/cases)
6. Duplicate candidate detection + controlled merge review (no silent merges)
7. Versioned qualification + deterministic scoring (explainable contributions + confidence)
8. Sales teams, territories, ownership, assignment history
9. Consent / communication preferences / DNC eligibility (never inferred)
10. Timeline / notes / tasks foundations
11. Opportunity readiness + handoff payload (**no** Opportunity / Pipeline / Revenue invent)
12. Import / report / export **foundations** (stubs + honesty gates)
13. Phase 12 pack at Wave 4 exit

## Explicitly deferred / NOT_AVAILABLE

| Item | Disposition |
|------|-------------|
| Email → Lead ingest | Contract only — no simulated mailbox |
| WhatsApp Business API → Lead | CTA exists; no API ingest; contract only |
| Opportunities / Pipelines / forecasting | Phase 12+ |
| Full CRM import tooling | Foundations only in Wave 4 |
| Full CRM reporting / schedules | Foundations; no false zeroes |
| AI scoring / AI messages / ML qualification | Forbidden |
| Billing / MRR / subscription mutation from CRM | Forbidden |
| Tenant GL / MRA credentials / payment secrets | Forbidden |
| CoA admin route revival | Forbidden (stays removed) |

## Exit expectation

**READY_FOR_PHASE_12_WITH_BLOCKERS** when core Crm* plane + capture + qualification/scoring + ownership/consent are trustworthy and Email/WhatsApp/full import/reporting remain explicit blockers.
