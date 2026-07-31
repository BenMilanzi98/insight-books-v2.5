# CRM Core Foundation Phase 11 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Checkbox steps for tracking.

**Goal:** Ship `/insightbooks/crm` with canonical CrmAccount / CrmContact / CrmLead (distinct from Customer, SupportTicket, CsCase), idempotent capture, qualification, deterministic scoring, ownership/consent/duplicates, and opportunity-readiness — admin plane + dedicated public forms.

**Architecture:** Wave 0 matrices → `lib/admin/crm/*` + Crm* Prisma models → APIs → UI. Email/WhatsApp Lead ingest stay NOT_AVAILABLE with contracts. Import/full reporting = foundations.

**Tech Stack:** Next.js, Prisma, Vitest, AdminShell, metric envelopes, en/ny, owner/team/territory scope.

**Spec:** [docs/superpowers/specs/2026-07-30-crm-core-phase-11-design.md](../specs/2026-07-30-crm-core-phase-11-design.md)

## Global Constraints

- Lead ≠ Opportunity ≠ Customer ≠ Support Ticket ≠ CsCase.
- CRM Account ≠ canonical Customer (link only).
- Contact ≠ Platform User (link only).
- Capture idempotent; consent never inferred; DNC enforced.
- Scoring deterministic, versioned, explainable, confidence — not probability/Revenue.
- No silent merges; SoD on approvals.
- No fabricated Leads/Contacts/consent; no false zeroes; no AI scoring/messages.
- Email/WhatsApp Lead ingest deferred (contracts only).
- CoA admin route stays removed.
- Commits only when user asks.

---

### Task 0: Wave 0 — Forensic audits + matrices

**Files:** `docs/admin-intelligence-crm/phase-11/*`

- [x] Validate Phase 10 READY_FOR_PHASE_11_WITH_BLOCKERS
- [x] CURRENT_* audits + matrices + gap register + IMPLEMENTATION_PLAN
- [x] CONDITIONAL GO for Wave 1
- [x] Stop before Wave 1 code unless user says continue

---

### Task 1: Wave 1 — Account / Contact / Lead + numbering + state machine + APIs

**Files:** `lib/admin/crm/{catalogue,accounts,contacts,leads,numbering,stateMachine,authz,index}.js`; Prisma CrmAccount/CrmContact/CrmLead + status history; APIs create/list/get; SQL fallback; permissions/nav stubs; tests

- [ ] Unique `LEAD-YYYY-######` / Account / Contact numbering (concurrency-safe)
- [ ] Canonical Lead statuses + invalid transition rejection
- [ ] Distinct from Customer / SupportTicket / CsCase
- [ ] Vitest PASS

---

### Task 2: Wave 2 — Public capture + handoffs → Lead + duplicate candidates

**Files:** capture service; `/contact` wire; `/request-demo`, `/start-trial`, `/sales-enquiry`; handoff intake from CS/Support/Product; duplicate candidates; tests

- [ ] Idempotent capture (exact retries return existing Lead)
- [ ] Distinct source codes per form/handoff
- [ ] Email/WhatsApp marked NOT_AVAILABLE
- [ ] Vitest PASS

---

### Task 3: Wave 3 — Qualification + scoring + ownership/territories + consent/DNC

**Files:** qualification/*, scoring/*, teams, territories, assignment, consent, eligibility; APIs; tests

- [ ] Versioned qualification; UNKNOWN ≠ NO
- [ ] Deterministic score + contributions + confidence; not probability
- [ ] Assignment history; no silent reassign loops
- [ ] Consent source-traceable; DNC blocks eligibility
- [ ] Vitest PASS

---

### Task 4: Wave 4 — Timeline/tasks/notes + merge + readiness + UI + Phase 12 pack

**Files:** timeline, notes, tasks, merge, opportunityReadiness, handoff payload; UI under `app/insightbooks/crm/**`; import/report stubs; `FINAL_PHASE_11_REPORT.md`, `PHASE_12_INPUTS.md`

- [x] Merge SoD; evidence preserved
- [x] Opportunity readiness does not create Opportunity
- [x] Exit READY_FOR_PHASE_12_WITH_BLOCKERS
- [x] Related vitest PASS

---

## Plan self-review

Spec waves map to Tasks 0–4. No TBD blocking Wave 0. Commit steps omitted per global constraint.
