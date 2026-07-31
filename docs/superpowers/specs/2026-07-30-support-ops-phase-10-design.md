# Support & Service Operations Phase 10 — Design

**Status:** Approved (conversation 2026-07-30); Wave 0 first  
**Date:** 2026-07-30  
**Surface:** `/insightbooks/support`  
**Architecture:** Approach B — dedicated Support domain (distinct from CsCase)

---

## 1. Purpose

Deliver an authoritative, secure Support Operations plane for InsightBooks platform admins: tickets, queues, assignment, public/internal messaging, attachment boundary, and versioned SLA clocks — without conflating Support with Customer Success, CRM, or platform incidents.

---

## 2. Locked decisions

| Topic | Decision |
|-------|----------|
| Sequencing | Wave 0 forensic audits + matrices before code |
| Customer portal | Later wave; tenant `/support` stays disabled/redirect |
| Inbound channels | Manual + in-admin create; email-to-ticket & WhatsApp = `NOT_AVAILABLE` + contracts |
| Ops depth | Core ops + versioned SLA; KB/problems/automations/CSAT = foundations |
| Architecture | Dedicated `lib/admin/support/*` + Support* Prisma models |
| Exit | `READY_FOR_PHASE_11_WITH_BLOCKERS` if email/portal/WhatsApp remain unavailable |

---

## 3. Hard rules

- Support Ticket ≠ CsCase ≠ Platform Incident ≠ CRM Lead.
- Public replies ≠ internal/restricted notes (API-enforced).
- Support never mutates billing, MRA fiscal, or Tenant GL/CoA/payroll.
- SLA clocks deterministic; acknowledgements ≠ human first response unless policy says so.
- No fabricated tickets/CSAT; no false zeroes; no AI replies/routing.
- Automations (when added) must be idempotent.
- `/insightbooks/chart-of-accounts` stays removed.
- Commits only when user asks.

---

## 4. Wave 0 — Forensic pack (docs only)

Create `docs/admin-intelligence-crm/phase-10/` with CURRENT_* audits, quality/recon/privacy/security/performance audits, matrices (source, domain, ticket state, priority, SLA, queue/team, visibility, attachment, integration, reliability, security), gap register, IMPLEMENTATION_PLAN, CONDITIONAL GO for Wave 1.

---

## 5. Domain architecture (post–Wave 0)

```text
SupportTicket (numbered SUP-YYYY-######)
  → Classification (type, impact, urgency, priority, severity)
  → Status history (canonical state machine)
  → Queue / Team / Assignment history
  → Messages (PUBLIC | INTERNAL | RESTRICTED)
  → Attachments (scan states; private storage)
  → SLA policy version + clocks + events
  → Handoffs (CS / Product / Finance / Technical / MRA / Billing) — link only
  → Foundations: Problem / KB / CSAT / Automation contracts
```

---

## 6. Waves after Wave 0

| Wave | Focus |
|------|--------|
| 0 | Audits + matrices + readiness |
| 1 | Ticket model, numbering, state machine, create/list/detail APIs |
| 2 | Messages, attachments boundary, queues/teams/assignment |
| 3 | SLA policies/calendars/clocks + My Work / list / detail UI |
| 4 | Handoffs, recon/export foundations, KB/problem/CSAT stubs, Phase 11 pack |

---

## 7. Approval

Conversational design **approved** 2026-07-30.
