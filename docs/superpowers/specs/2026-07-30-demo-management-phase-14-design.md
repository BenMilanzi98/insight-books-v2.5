# Sales Demo Management Phase 14 — Design

**Status:** Approved (user review 2026-07-30)  
**Date:** 2026-07-30  
**Surface:** `/insightbooks/crm/demos` (+ requests, environments, templates, reports)  
**Architecture:** Extend `lib/admin/crm/demos/*` — first-class Demo domain (Demo ≠ Meeting ≠ Trial ≠ Proposal)  
**Upstream exit:** Phase 13 `READY_FOR_PHASE_14_WITH_BLOCKERS`

---

## 1. Purpose

Deliver one authoritative, versioned, environment-isolated, consent-aware Demo Management plane for InsightBooks platform Sales: Demo requests through qualification, scheduling (via Phase 13 Meeting/Calendar), agendas/scripts, logical Demo environments with safe data packs, checklists/rehearsals, delivery, source-backed attendance, recording governance, feedback, outcomes, follow-ups, and Proposal/Trial handoff payloads — without fabricating engagement, copying Production data, generating Proposals, or provisioning Production Tenants/Subscriptions/Invoices.

---

## 2. Locked decisions

| Topic | Decision |
|-------|----------|
| Sequencing | **Approach B** — Wave 0 first; spine → content → env/delivery → ops |
| Environments | **Logical provisioner** — governance + local/logical READY path; no Production Tenant clone; no fabricated cloud provider |
| Recording | **Governance only** — request/consent/approve/deny; provider **NOT_AVAILABLE**; no fabricated recording files |
| Scheduling | **Required** CrmMeeting + Calendar Event; Demo times must reconcile; conflicts/timezone via Phase 13 |
| Reporting | **Reporting centre + scheduled reports** — honesty-gated; no false zeroes |
| Proposal / Trial / Tenant | **Handoff payloads only** — Phase 15 owns Proposal/Quotation; never auto-change Opportunity stage/probability/close date |
| Domain | Extend `lib/admin/crm/*` (`demos/`); never alias MRA EIS sandbox or Meeting-as-Demo |
| Exit | `READY_FOR_PHASE_15_WITH_BLOCKERS` when core Demo truth + isolation + attendance/outcome are trustworthy and optional providers remain explicit |

---

## 3. Hard rules

- Demo ≠ Meeting ≠ Trial ≠ Proposal; Demo Environment ≠ Production Tenant; Demo data ≠ Customer/Production data.
- Demo outcome ≠ win probability ≠ Closed Won ≠ Revenue certainty.
- RSVP ≠ attendance; attendance source-backed; no fabricated attendance/feedback/recordings/environments.
- Recording off by default; UNKNOWN consent ≠ GRANTED; provider NOT_AVAILABLE this phase.
- Environment provision/reset/deprovision idempotent; expiry required; credentials protected; visible DEMO banner.
- No Production DB/payment/MRA EIS endpoint/email sender connections on Demo environments.
- No automatic Opportunity stage / probability / close-date changes; use Phase 12 services only if human-gated later.
- No Proposal/Quotation/Contract/Tenant/Subscription/Invoice creation; CoA admin stays removed.
- Metric/report gate fail → never fabricated zero.
- Commits only when user asks; WORKING_TREE OK; SQL + `hasCrm*Model` guards if Prisma EPERM.

---

## 4. Domain architecture

```text
Lead / Opportunity / capture DEMO_REQUEST
        ↓
CrmDemoRequest (DMR-YYYY-######)
        ↓ qualify / convert (idempotent)
CrmDemo (DEMO-YYYY-######)
        ├── CrmMeeting + Calendar Event (required when scheduled)
        ├── Participants / Presenters (RSVP ≠ attendance; recording consent separate)
        ├── Agenda / Script / Scenario / Content versions (pinned)
        ├── Logical Environment (DENV-…) + DataPack + health + expiry
        ├── Checklist / Rehearsal → Readiness
        ├── Delivery session + Questions + live issues
        ├── Recording governance (no provider file)
        ├── Feedback + Outcome (+ completeness ≠ success)
        └── Follow-Up (Phase 13) + Proposal/Trial handoff payloads
```

**Reuse:** Phase 13 Meeting/Calendar/Task/Follow-Up/eligibility; Phase 12 Opportunity + proposal/conversion readiness re-eval; Phase 11 Lead `DEMO_REQUEST` / `REQUEST_DEMO`; AdminShell; en/ny.

**Do not alias:** MRA EIS sandbox entitlements, Support/CS tasks, analytics-pipeline, Tenant POS `sales.*`, Meeting-as-Demo.

---

## 5. Wave 0 — Forensic pack (docs only)

Create `docs/admin-intelligence-crm/phase-14/` CURRENT_* audits, DQ/recon/privacy/security/performance audits, matrices, gap register, IMPLEMENTATION_PLAN, FINAL_READINESS_DECISION (expect CONDITIONAL GO).

Validate Phase 13 `PHASE_14_INPUTS.md` / readiness checklist. Carry blockers: telephony, Google/Outlook, email ingest, scope stub, Prisma EPERM, recording provider, real infra env, weighted UI (Phase 16).

**Stop before Wave 1 code** until Wave 0 decision recorded and user chooses execution mode.

---

## 6. Waves after Wave 0

| Wave | Focus |
|------|--------|
| 0 | Audits + matrices + readiness |
| 1 | Demo Request + Demo + numbering; qualify/convert idempotent; schedule via Meeting; participants; readiness spine; Opportunity/Lead projections |
| 2 | Agenda/Script/Scenario/Content versioning + SoD approvals; customer-safe vs restricted projections |
| 3 | Logical Environment + templates + data packs + safety/Production detection; checklist + rehearsal; provision/reset/expiry idempotency |
| 4 | Delivery/attendance/recording gov/feedback/outcome/questions/follow-ups; Proposal/Trial handoffs; reports/schedules; Phase 15 pack |

---

## 7. UI & API sketch

**Hubs:** `/insightbooks/crm/demos` (overview, my-demos, team, calendar, requests, `[demoId]` sub-routes), demo-types/templates/scripts/scenarios/content/environments/data-packs/checklists/feedback-forms/reports/…

**APIs:** `app/api/admin/crm/demos|demo-requests|demo-environments|…` — server pagination/filter/sort; scope + FLS.

**Honesty envelopes:** readiness BLOCKED + reasons; env NOT_AVAILABLE vs logical READY explicit; recording NOT_AVAILABLE; metrics never false zeroes.

---

## 8. Testing & verification (per wave)

- Vitest: numbering, state machines, conversion/provision/reset/handoff idempotency, Meeting reconcile, readiness blocks, Production-data rejection, RSVP≠attendance, recording consent, outcome≠auto Opportunity mutation, report honesty.
- Regression: Phase 12 opportunity + Phase 13 activity/meeting suites.
- SQL fallbacks + model guards on Prisma EPERM.

---

## 9. Out of scope (explicit)

Proposal/Quotation/e-sign/contracts; Production Tenant/Subscription/Invoice/Payment; AI scripts/answers/summaries; live recording provider; real cloud/container Demo infra; automatic Opportunity mutations; full Trial management; Production data cloning; Sales quotas/commissions; accounting/billing/MRA fiscal changes; System CoA admin.

---

## 10. Approval

Conversational design sections §1–§3 **approved** 2026-07-30.  
**This file:** user-reviewed and **approved** 2026-07-30. Next: implementation plan → Wave 0.
