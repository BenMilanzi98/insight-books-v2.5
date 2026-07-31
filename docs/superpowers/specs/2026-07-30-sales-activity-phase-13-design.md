# Sales Activity & Engagement Phase 13 — Design

**Status:** Approved (user review 2026-07-30)  
**Date:** 2026-07-30  
**Surface:** `/insightbooks/crm/activities` (+ tasks, follow-ups, calls, emails, meetings, calendar, notes, reminders, activity-reports)  
**Architecture:** Extend `lib/admin/crm/*` — canonical `CrmActivity` parent + typed children  
**Upstream exit:** Phase 12 `READY_FOR_PHASE_13_WITH_BLOCKERS`

---

## 1. Purpose

Deliver one authoritative, consent-aware, timezone-correct, source-traceable Sales Activity domain for InsightBooks platform Sales: Tasks, Follow-Ups, Calls, Emails, Meetings, internal Calendar, Reminders, Notes, automation foundations, and Activity reporting — without fabricating engagement, bypassing DNC/consent, provisioning Tenants/Subscriptions/Invoices, implementing Demo/Proposal management, or aliasing Support/CS/analytics systems.

---

## 2. Locked decisions

| Topic | Decision |
|-------|----------|
| Sequencing | **Approach B** — Wave 0 forensic audits first; spine → channels → calendar → ops |
| Activity shape | **Parent + typed children** — `CrmActivity` + `CrmTask` / `CrmFollowUp` / `CrmCall` / `CrmEmailActivity` / `CrmMeeting` / calendar projection; migrate existing `CrmTask` under Activity |
| Email depth | **Real SMTP send** via existing platform email libs; provider accept ≠ delivered; no fabricated opens/replies; inbound Lead ingest remains NOT_AVAILABLE |
| Calendar sync | **Google / Outlook = NOT_CONNECTED** typed contracts; ICS export in-phase; no fabricated external sync |
| Calls / telephony | **Manual + planned** + typed telephony provider boundary **NOT_AVAILABLE**; recording **NOT_AVAILABLE** |
| Automation | **Foundations only** — rule model, SoD approval, idempotent engine, small approved trigger set (e.g. Lead assigned → first-contact Task; stage entry → checklist; no-next-action warning). No full sales sequences; no arbitrary code |
| Reporting | **Reporting centre + scheduled Activity reports** — honesty gates; no false zeroes |
| Domain | Extend `lib/admin/crm/*`, not POS / Support / CS / separate plane |
| Exit | `READY_FOR_PHASE_14_WITH_BLOCKERS` when core Activity truth + consent + calendar internals are trustworthy and optional providers remain explicit |

---

## 3. Hard rules

- Activity ≠ Audit Event ≠ Analytics Event.
- Task ≠ Call ≠ Meeting ≠ Demo; Note ≠ outbound communication; Meeting ≠ Demo (`DEMO_REQUEST` = handoff reference only → Phase 14).
- One Activity record; many timeline projections — do not duplicate Activities per Lead/Opportunity/Account view.
- Planned ≠ completed; due-date pass ≠ complete; reminder ≠ Sales contact; RSVP ≠ attendance; SMTP accept ≠ delivered.
- Outbound Call / Email / invitation requires server eligibility (Contact, purpose, channel, consent, DNC, prefs/timezone, permission) with persisted decision; UNKNOWN consent ≠ granted.
- No fabricated Activities, Calls, Emails, deliveries, replies, Meetings, attendance, or external calendar Events.
- No AI-generated emails/scripts/summaries/next-actions; no undisclosed tracking pixels; no Call recording without full legal/consent/retention stack (default OFF / NOT_AVAILABLE).
- Owner / team / territory / portfolio scope enforced server-side; no Cross-Tenant links; internal/restricted Notes never on Customer APIs, invitations, or default exports.
- CoA admin route stays removed; no Tenant GL / payment / MRA secret exposure; no accounting/billing/MRA fiscal changes.
- Commits only when user asks; WORKING_TREE OK; SQL + model guards if Prisma EPERM.

---

## 4. Domain architecture

```text
Lead | Account | Contact | Opportunity
        ↓
CrmActivity (ACT-YYYY-######) — type, status, direction, outcome, owner, timezone, primary relation, idempotency
        ├── CrmTask (+ checklist / deps / recurrence / templates)  ← migrate P11/P12 CrmTask
        ├── CrmFollowUp (+ next-action / no-next-action detection)
        ├── CrmCall (manual/planned; telephony boundary NOT_AVAILABLE)
        ├── CrmEmailActivity (+ send request / delivery events; SMTP)
        ├── CrmMeeting (+ participants, RSVP ≠ attendance, outcomes)
        ├── Note relation / type NOTE (CrmNote security preserved)
        └── CrmCalendarEvent (internal; external sync NOT_CONNECTED)
        ↓
Eligibility → Outcome → Follow-Up → Entity timeline → Metrics / reports
```

**Reuse:** `lib/admin/crm/{tasks,notes,timeline,consent,eligibility,foundations}.js`; Opportunity tasks/timeline/next-action hooks; AdminShell; en/ny; `lib/email.js` / `lib/emailService.js` for send-request only.

**Do not alias:** `CsTask`, Support tickets/messages, `SupportSlaCalendar`, `/insightbooks/analytics-pipeline`, Tenant POS `sales.*`.

---

## 5. Wave 0 — Forensic pack (docs only)

Create `docs/admin-intelligence-crm/phase-13/` CURRENT_* audits, privacy/security/performance/DQ/recon audits, matrices (source, domain, task/call/email/meeting state, calendar integration, reminder, consent eligibility, reliability, security), gap register, IMPLEMENTATION_PLAN, CONDITIONAL GO for Wave 1.

Validate Phase 12 inputs (`PHASE_13_INPUTS.md`, readiness checklist). Carry blockers: weighted Pipeline UI (Phase 16), scope stub, Email/WhatsApp Lead ingest, Prisma EPERM, Account/Contact merge, conversion ≠ Closed Won provision.

**Stop before Wave 1 code** until Wave 0 readiness decision is recorded and user chooses execution mode.

---

## 6. Waves after Wave 0

| Wave | Focus |
|------|--------|
| 0 | Audits + matrices + readiness |
| 1 | Canonical Activity + numbering + relations/participants; migrate Task/Note under Activity; Follow-Up + Next-Action; timeline extensions; notes security |
| 2 | Call (manual/planned + telephony boundary); Email Activity (draft → eligibility → SMTP send-request → idempotent callbacks); email templates foundations |
| 3 | Meeting + internal Calendar views + working hours + availability + conflict + ICS export; Google/Outlook contracts NOT_CONNECTED |
| 4 | Reminders (dedupe); activity/task templates; automation foundations; reporting centre + schedules; entity integrations; Phase 14 pack |

---

## 7. UI & API sketch

**Hubs:** `/insightbooks/crm/activities` (overview, my-work, all, `[id]`, timeline), `/tasks`, `/follow-ups`, `/calls`, `/emails`, `/meetings`, `/calendar` (day/week/month/agenda), `/notes`, `/reminders`, activity-types/outcomes/templates/rules, activity-reports / data-quality / reconciliation / audit / settings.

**Entity extensions:** Lead/Account/Contact/Opportunity `…/activities` (+ existing tasks/timeline); Opportunity also calls/emails/meetings panels.

**APIs:** `app/api/admin/crm/activities|tasks|follow-ups|calls|emails|meetings|calendar|reminders|…` — server pagination/filter/sort; scope + FLS; no browser-authoritative overdue / eligibility / conflict.

**Honesty envelopes:** eligibility BLOCKED + reason; metric gate failures never return fabricated zeroes; external calendar NOT_CONNECTED; telephony/recording NOT_AVAILABLE.

---

## 8. Testing & verification (per wave)

- Vitest: numbering, status compatibility, idempotent create/complete/send/callback/reminder/recurrence/automation, consent/DNC, timezone, conflict, SoD automation approval, report honesty.
- Regression: Phase 11/12 task, timeline, opportunity, foundations suites.
- SQL fallbacks + `hasCrm*Model` guards when Prisma generate EPERM on Windows.

---

## 9. Out of scope (explicit)

Complete Demo Management (Phase 14); Proposal/Quotation/e-sign/contracts; Tenant/Customer/Subscription/Invoice/Payment creation; full sales sequences; AI communications; live telephony; Google/Outlook sync; WhatsApp provider; undisclosed tracking; Sales quotas/commissions; accounting/billing/MRA fiscal changes; System CoA admin.

---

## 10. Approval

Conversational design sections §1–§3 **approved** 2026-07-30.  
**This file:** user-reviewed and **approved** 2026-07-30. Next: implementation plan → Wave 0.
