# Phase 12 Gap Register

**Audited:** 2026-07-30  
**Inputs:** Phase 11 `PHASE_12_INPUTS.md`, `FINAL_PHASE_11_REPORT.md`, Wave 0 audits, design/plan

| ID | Gap | Severity | Wave | Notes |
|----|-----|----------|------|-------|
| G12-01 | No CrmOpportunity / CrmPipeline / Stage models | BLOCKER | 1 | Greenfield under `lib/admin/crm/*` |
| G12-02 | No `/insightbooks/crm/pipeline` or `/opportunities` UI | BLOCKER | 3 (stubs 1) | Board/list/My Pipeline Wave 3 |
| G12-03 | Pipeline permissions scaffold only; no `opportunity.*` keys | BLOCKER | 1 | Live authz + nav |
| G12-04 | No Opportunity numbering / create-from-READY consumer | BLOCKER | 1 | Idempotent `OPP-YYYY-######` |
| G12-05 | No server stage transition service / history | BLOCKER | 1 | Drag never persists alone |
| G12-06 | NEW_BUSINESS Pipeline + stages seed | BLOCKER | 1 | ACTIVE first |
| G12-07 | Contact roles on Opportunity | HIGH | 2 | Preserve Contact ≠ User |
| G12-08 | Products + non-binding commercial estimates | HIGH | 2 | Currency explicit; ≠ Revenue |
| G12-09 | Explainable probability + confidence | HIGH | 2 | ≠ Lead score; ≠ ML |
| G12-10 | Close-date provenance + history | HIGH | 2 | No fabricated dates |
| G12-11 | Risks / tasks / timeline on Opportunity | MEDIUM | 3 | ≠ Support/CS threads |
| G12-12 | Win/loss + Closed Won evidence | HIGH | 3 | No Tenant/Subscription/Invoice provision |
| G12-13 | Proposal / conversion readiness payloads | MEDIUM | 3 | Handoff only |
| G12-14 | Duplicate Opportunity + merge SoD | HIGH | 4 | No silent merges; idempotent create Wave 1 |
| G12-15 | Opportunity import (full) | HIGH | 4 | In-phase; honesty gates |
| G12-16 | Pipeline reports + schedules | HIGH | 4 | Currency-separated; no false zeroes |
| G12-17 | EXPANSION / MRA_EIS Pipelines | MEDIUM | 4 | After NEW_BUSINESS |
| G12-18 | Weighted Pipeline UI / reports | DEFERRED | Phase 16 | Service may exist; flag OFF |
| G12-19 | Competitor intelligence depth | DEFERRED | Optional | NOT_AVAILABLE OK for exit WITH_BLOCKERS |
| G12-20 | Partner / legacy Opportunity sources | DEFERRED | Optional | Same |
| G12-21 | analytics-pipeline confusion risk | PROCESS | All | WRONG_DOMAIN docs + guards |
| G12-22 | Opportunity value ↔ Phase 6 Revenue mix risk | PROCESS | All | Guards in APIs/UI/copy |
| G12-23 | Lead → Tenant conversion transaction | CARRY | Phase 12+ / later | Conversion readiness ≠ provision |
| G12-24 | Owner/team/territory list scope stub | CARRY | Harden in-phase | `resolveCrmScope` mode all |
| G12-25 | Email / WhatsApp Lead ingest | CARRY | Orthogonal | NOT_AVAILABLE — do not invent volume |

**No TBD blocking Wave 1 after CONDITIONAL GO** — READY handoff + CrmLead plane + approved design are sufficient to start NEW_BUSINESS Pipeline + Opportunity create; commercial/UI/import/reports follow Waves 2–4; weighted UI and optional competitor/partner remain explicit blockers toward `READY_FOR_PHASE_13_WITH_BLOCKERS`.
