# Support & Service Operations Phase 10 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Checkbox steps for tracking.

**Goal:** Ship `/insightbooks/support` with canonical SupportTickets (distinct from CsCase), messaging visibility controls, queues/assignment, and versioned SLA clocks — admin plane first.

**Architecture:** Wave 0 matrices → `lib/admin/support/*` + Support* Prisma models → APIs → UI. Email/WhatsApp/portal stay NOT_AVAILABLE with contracts until later waves.

**Tech Stack:** Next.js, Prisma, Vitest, AdminShell, metric envelopes, en/ny, portfolio/queue scope.

**Spec:** [docs/superpowers/specs/2026-07-30-support-ops-phase-10-design.md](../specs/2026-07-30-support-ops-phase-10-design.md)

## Global Constraints

- Support Ticket ≠ CsCase ≠ Platform Incident ≠ CRM Lead.
- Public ≠ internal ≠ restricted notes (API-enforced).
- No billing/MRA fiscal/Tenant GL mutation from Support.
- SLA deterministic; ack ≠ human first response by default.
- No fabricated tickets/CSAT; no false zeroes; no AI replies.
- Email-to-ticket / WhatsApp / customer portal deferred (contracts only in core waves).
- CoA admin route stays removed.
- Commits only when user asks.

---

### Task 0: Wave 0 — Forensic audits + matrices

**Files:** `docs/admin-intelligence-crm/phase-10/*`

- [x] Validate Phase 9 READY_FOR_PHASE_10_WITH_BLOCKERS
- [x] CURRENT_* audits + matrices + gap register + IMPLEMENTATION_PLAN
- [x] CONDITIONAL GO for Wave 1
- [x] Stop before Wave 1 code unless user says continue

---

### Task 1: Wave 1 — Ticket model + numbering + state machine + APIs

**Files:** `lib/admin/support/{catalogue,tickets,numbering,stateMachine,authz,index}.js`; Prisma SupportTicket + StatusHistory; APIs create/list/get; SQL fallback; tests

- [ ] Unique SUP-YYYY-###### numbering (concurrency-safe)
- [ ] Canonical statuses + invalid transition rejection
- [ ] Distinct from CsCase
- [ ] Vitest PASS

---

### Task 2: Wave 2 — Messages + attachments boundary + queues/teams/assignment

**Files:** messages, attachments, queues, teams, assignment modules + APIs + tests

- [ ] Internal notes never in customer projections (even if portal later)
- [ ] Attachment PENDING_SCAN not downloadable
- [ ] Assignment history; no silent reassign loops
- [ ] Vitest PASS

---

### Task 3: Wave 3 — SLA + My Work / list / detail UI

**Files:** sla policies/calendars/clocks; UI under `app/insightbooks/support/**`; nav/i18n

- [ ] First-response / resolution clocks with business calendar
- [ ] Ack does not satisfy human first-response by default
- [ ] Breach immutable
- [ ] Nav map + vitest PASS

---

### Task 4: Wave 4 — Handoffs + foundations + Phase 11 pack

**Files:** handoffs to CS/Product/Finance/MRA/Billing; recon/export foundations; KB/problem/CSAT stubs; `FINAL_PHASE_10_REPORT.md`, `PHASE_11_INPUTS.md`

- [ ] Handoffs link-only; no source mutation
- [ ] Exit READY_FOR_PHASE_11_WITH_BLOCKERS
- [ ] Related vitest PASS

---

## Plan self-review

Spec waves map to Tasks 0–4. No TBD blocking Wave 0.
