# Phase 14 — Sales Demo Management



**Surface:** `/insightbooks/crm/demos` (+ requests, environments, templates, reports)  

**Architecture:** Extend `lib/admin/crm/demos/*` — first-class Demo domain (Demo ≠ Meeting ≠ Trial ≠ Proposal)  

**Design:** `docs/superpowers/specs/2026-07-30-demo-management-phase-14-design.md`  

**Plan:** `docs/superpowers/plans/2026-07-30-demo-management-phase-14.md`  

**Handoff in:** `docs/admin-intelligence-crm/phase-13/PHASE_14_INPUTS.md`  

**Phase 13 exit:** `READY_FOR_PHASE_14_WITH_BLOCKERS`  

**Phase 14 exit:** `READY_FOR_PHASE_15_WITH_BLOCKERS` — see `FINAL_PHASE_14_REPORT.md`



## Wave status



| Wave | Focus | Status |

|------|-------|--------|

| 0 | Forensic audits + matrices + CONDITIONAL GO | Complete (2026-07-30) |

| 1 | Demo Request + Demo + numbering; qualify/convert; schedule via Meeting; participants; readiness spine | Complete |

| 2 | Agenda / Script / Scenario / Content versioning + SoD approvals | Complete |

| 3 | Logical Environment + data packs + checklist/rehearsal; provision/reset/expiry | Complete |

| 4 | Delivery/attendance/recording gov/feedback/outcome/follow-ups; Proposal/Trial handoffs; reports; Phase 15 pack | Complete |



**Phase exit:** `READY_FOR_PHASE_15_WITH_BLOCKERS`  

**Phase 15 pack:** `FINAL_PHASE_14_REPORT.md`, `PHASE_15_INPUTS.md`, `PHASE_15_READINESS_CHECKLIST.md`, `FINAL_READINESS_DECISION.md`



## Hard rules



- Demo ≠ Meeting ≠ Trial ≠ Proposal; Demo Environment ≠ Production Tenant; Demo data ≠ Customer/Production data

- Demo outcome ≠ win probability ≠ Closed Won ≠ Revenue certainty

- RSVP ≠ attendance; attendance source-backed; no fabricated attendance/feedback/recordings/environments

- Recording off by default; UNKNOWN consent ≠ GRANTED; provider NOT_AVAILABLE this phase

- Scheduling requires CrmMeeting + Calendar Event; times must reconcile

- Logical environments only — no Production DB/payment/MRA EIS endpoint/email sender connections

- No automatic Opportunity stage / probability / close-date changes

- No Proposal/Quotation/Contract/Tenant/Subscription/Invoice creation; CoA admin stays removed

- Metric/report gate fail → never fabricated zero

- Never alias MRA EIS sandbox entitlements, Support/CS tasks, analytics-pipeline, Tenant POS `sales.*`, Meeting-as-Demo



## Classification legend



| Class | Meaning |

|-------|---------|

| READY | Usable as-designed for Phase 14 consumption |

| PARTIAL | Exists but incomplete / not Demo-shaped |

| FOUNDATION | Thin foundations present; needs Wave work |

| NOT_FOUND | Absent in codebase / schema |

| WRONG_DOMAIN | Exists but belongs to another plane |

| NOT_AVAILABLE | Explicitly deferred with contract |

| NOT_CONNECTED | External integration contract present; sync not live |

| BLOCKED | Cannot proceed until dependency cleared |

| CORRECT_AND_REUSABLE | Keep as boundary / input; do not redefine |

| EXTEND | Reuse and extend under Demo domain |

| FORBIDDEN | Must not be reused as Demo truth |

| CARRY | Known carry blocker from prior phases |


