# Phase 11 Inputs (from Phase 10)

Handoff expectations for the next phase. This document does **not** invent Phase 11 scope beyond what Support Ops can safely consume.

| Asset | Path / surface |
|-------|----------------|
| Support catalogue / state machine | `lib/admin/support/catalogue.js`, `stateMachine.js` |
| Tickets / numbering | `tickets.js`, `numbering.js` — `SUP-YYYY-######` |
| Messages + customer projection helper | `messages.js` (`projectForCustomer` — portal deferred) |
| Attachments (private storage + scan states) | `attachments.js` — not `public/uploads` |
| Queues / teams / assignment | `queues.js`, `teams.js`, `assignment.js` |
| SLA clocks (versioned policy + calendar) | `lib/admin/support/sla/*` — ack ≠ first response by default |
| Link-only handoffs | `handoffs.js` — CS / Product / Finance / Billing / MRA |
| Reconciliation / export foundations | `reconciliation.js`, `export.js` |
| KB / Problem / CSAT / Automation contracts | `foundations.js` — no fake CSAT |
| Authz | `authz.js` — view / create / transition / notes / assign / export / runReconciliation |
| UI shell | `/insightbooks/support/*` (My Work, tickets, handoffs, reports, foundations) |
| APIs | `/api/admin/support/*` |
| Prisma models | `SupportTicket`, messages, attachments, queues/teams, SLA*, `SupportHandoff`, recon/export audit |
| Matrices / audits | `docs/admin-intelligence-crm/phase-10/*` |
| Final Phase 10 | `FINAL_PHASE_10_REPORT.md` — **READY_FOR_PHASE_11_WITH_BLOCKERS** |

**Reuse from earlier phases:** Phase 8 CS handoff pattern (record-only); Phase 9 product catalogue `featureCode` (optional PRODUCT handoff link); portfolio scope patterns; `exportSafety.preventFormulaInjection`; metric honesty / reliability gates.

**Consumer expectations (likely Phase 11 themes — not committed scope):**

1. **Inbound channels** — email-to-ticket / WhatsApp / portal only when producers + ACL + volume honesty exist; keep `NOT_AVAILABLE` until then
2. **Portal customer surface** — reuse `projectForCustomer`; never leak INTERNAL / RESTRICTED
3. **KB / deflection** — replace foundation contract with instrumented article plane; no invented deflection %
4. **CSAT** — survey capture with real responses only; never seed fake scores
5. **Automation** — rules/routing without AI hallucinated replies; preserve SLA clock semantics
6. **Problem Management** — deepen FOUNDATION into real problem records linked to tickets (still ≠ CsCase)
7. **Handoff consumers** — CS / Billing / MRA / Product may *read* SupportHandoff links; Support create remains link-only (no side-effect mutations)

**Do not consume as truth:** CsCase counts as support volume; login proxies as CSAT; empty recon as 0% breach; missing channel volume as zero tickets; Tenant GL / MRA credentials / payment secrets on tickets; CoA admin revival.
