# Phase 11 Gap Register

**Audited:** 2026-07-30  
**Inputs:** Phase 1 `CRM_GAP_REGISTER.md`, Phase 10 `PHASE_11_INPUTS.md`, Wave 0 audits

| ID | Gap | Severity | Wave | Notes |
|----|-----|----------|------|-------|
| G11-01 | No CrmAccount / CrmContact / CrmLead models | BLOCKER | 1 | Greenfield Approach B |
| G11-02 | No `/insightbooks/crm/**` product UI | BLOCKER | 4 (stubs 1) | Nav stubs early; My Work/list/detail Wave 4 |
| G11-03 | CRM permissions scaffold only (default deny) | BLOCKER | 1 | Live `systemAdmin.crm.*` authz |
| G11-04 | No Lead numbering / status state machine | BLOCKER | 1 | `LEAD-YYYY-######` |
| G11-05 | Public `/contact` does not persist Lead | HIGH | 2 | Wire shared capture |
| G11-06 | Missing `/request-demo`, `/start-trial`, `/sales-enquiry` | HIGH | 2 | Distinct source codes |
| G11-07 | No idempotent capture service | HIGH | 2 | Exact retries return existing |
| G11-08 | CS / Support handoffs have no Lead bridge | HIGH | 2 | Record-read → Lead create; no source mutation |
| G11-09 | Duplicate candidates + merge SoD | HIGH | 2 / 4 | No silent merges |
| G11-10 | Qualification definitions / responses | HIGH | 3 | UNKNOWN ≠ NO |
| G11-11 | Deterministic scoring + confidence | HIGH | 3 | ≠ probability / Revenue |
| G11-12 | Sales teams / territories / assignment history | HIGH | 3 | ≠ SupportTeam / POS sales |
| G11-13 | Consent / prefs / DNC eligibility | HIGH | 3 | Never infer consent |
| G11-14 | Timeline / notes / tasks | MEDIUM | 4 | Foundations |
| G11-15 | Opportunity readiness handoff (no Opportunity create) | MEDIUM | 4 | Phase 12 consumes |
| G11-16 | Email → Lead ingest | DEFERRED | Later | NOT_AVAILABLE + contract |
| G11-17 | WhatsApp → Lead ingest | DEFERRED | Later | CTA only today |
| G11-18 | Full import tooling | DEFERRED | Foundations 4 | No fake import success |
| G11-19 | Full reporting / schedules | DEFERRED | Foundations 4 | Honesty gates |
| G11-20 | Tenant POS `sales.*` confusion risk | PROCESS | All | WRONG_DOMAIN docs + guards |
| G11-21 | Customer / CsCase / SupportTicket conflation | PROCESS | All | API + UI copy guards |
| G11-22 | Pipeline scaffold keys before Opportunity plane | PROCESS | 1–4 | Do not invent Pipeline UI |
| G11-23 | Lead → Tenant conversion transaction | CARRY | Phase 12+ | Human Tenant create today |
| G11-24 | Opportunities / forecasting / proposals | CARRY | Phase 12+ | Out of Phase 11 create scope |

**No TBD blocking Wave 1 after CONDITIONAL GO** — greenfield models + authz are sufficient to start; capture/channels follow Waves 2–4 / deferred contracts.
