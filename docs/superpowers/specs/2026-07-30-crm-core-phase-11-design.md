# CRM Core Foundation Phase 11 — Design

**Status:** Approved (conversation 2026-07-30); Wave 0 first  
**Date:** 2026-07-30  
**Surface:** `/insightbooks/crm`  
**Architecture:** Approach B — dedicated CRM domain (distinct from Customer, SupportTicket, CsCase, Tenant Client, POS `sales.*`)

---

## 1. Purpose

Deliver one authoritative, privacy-preserving CRM foundation for InsightBooks platform Sales and Management: CrmAccount, CrmContact, CrmLead, idempotent capture, qualification, deterministic scoring, ownership/territories, consent/DNC, duplicate review, and opportunity-readiness handoff — without creating Opportunities, Pipelines, or inventing Revenue.

---

## 2. Locked decisions

| Topic | Decision |
|-------|----------|
| Sequencing | Wave 0 forensic audits + matrices before code |
| Public capture | Wire `/contact` + dedicated `/request-demo`, `/start-trial`, `/sales-enquiry` (shared capture service; distinct source codes) |
| Email / WhatsApp Lead ingest | `NOT_AVAILABLE` + contracts only — no simulated messages |
| Ops depth | Core CRM; import/report/schedule as foundations |
| Architecture | Dedicated `lib/admin/crm/*` + `Crm*` Prisma models |
| Exit | `READY_FOR_PHASE_12_WITH_BLOCKERS` if Email/WhatsApp/full import/reporting remain deferred |

---

## 3. Hard rules

- Lead ≠ Opportunity ≠ Customer ≠ Support Ticket ≠ CsCase.
- CRM Account may link to canonical Customer; must not duplicate billing/MRR/subscription truth.
- Contact ≠ Platform User (verified link only; no auto access grant).
- Capture idempotent; consent never inferred; DNC enforced via eligibility service.
- Qualification ≠ scoring; score ≠ win/conversion probability; scores versioned + explainable + confidence.
- No silent merges; SoD on merge / score-definition / qualification-definition approval.
- No fabricated Leads/Contacts/consent; no false zeroes; no AI scoring/messages/qualification.
- No Tenant GL / payment secrets / MRA credentials; CoA admin route stays removed.
- Commits only when user asks.

---

## 4. Wave 0 — Forensic pack (docs only)

Create `docs/admin-intelligence-crm/phase-11/` with CURRENT_* audits, quality/recon/privacy/security/performance audits, matrices (source, domain, lead state, qualification, scoring, assignment, territory, consent, duplicate, reliability, security), gap register, IMPLEMENTATION_PLAN, CONDITIONAL GO for Wave 1.

---

## 5. Domain architecture (post–Wave 0)

```text
CrmLead (LEAD-YYYY-######)
  → Source + Channel + idempotency key
  → CrmAccount / CrmContact links (evidence-backed)
  → Status history (canonical state machine)
  → Qualification (versioned definition + responses)
  → Score evaluation (versioned + contributions + confidence)
  → Ownership / team / territory + assignment history
  → Consent + communication preferences + DNC
  → Timeline / notes / tasks (foundations)
  → Duplicate candidates → controlled merge
  → Opportunity readiness + handoff payload (no Opportunity create)

CrmAccount (ACC-…) ↔ optional Customer / Tenant link
CrmContact (CON-…) ↔ Account / Customer / PlatformUser links
```

---

## 6. Waves after Wave 0

| Wave | Focus |
|------|--------|
| 0 | Audits + matrices + readiness |
| 1 | Account / Contact / Lead models, numbering, status SM, manual APIs, permissions/nav stubs |
| 2 | Public capture + dedicated forms; CS/Support/Product handoff→Lead; duplicate candidates |
| 3 | Qualification + deterministic scoring; teams/territories/assignment; consent/DNC eligibility |
| 4 | Timeline/tasks/notes; merge review; opportunity readiness; My Work/list/detail UI; import/report stubs; Phase 12 pack |

---

## 7. Approval

Conversational design **approved** 2026-07-30.
