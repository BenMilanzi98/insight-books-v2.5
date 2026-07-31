### Task 4: Wave 4 — Handoffs + foundations + Phase 11 pack

**Depends on:** Waves 1–3 Support domain (WORKING_TREE).

**Files (create / extend):**
- `lib/admin/support/handoffs.js` — create/list handoffs linking SupportTicket ↔ CS / Product / Finance / MRA / Billing targets (**link-only**; never mutate source subscription, fiscal, Tenant GL, or CsCase status as side-effect of handoff create)
- `lib/admin/support/reconciliation.js` — ticket vs status history / message counts / SLA clock consistency checks; reliability states; **never false zeroes**
- `lib/admin/support/export.js` — CSV/JSON export foundation (permission `export`); recheck permission on download; no XLSX/PDF required
- `lib/admin/support/foundations.js` — stubs/contracts for Knowledge Base, Problem Management, CSAT/Satisfaction, Automation (status NOT_AVAILABLE / FOUNDATION with explicit contracts — no fake CSAT scores)
- Extend catalogue/authz/index as needed
- Prisma: `SupportHandoff` (+ optional recon run / export audit tables if minimal)
- SQL: `scripts/sql/support-ops-phase10-wave4.sql`
- APIs:
  - `app/api/admin/support/tickets/[id]/handoffs` GET/POST
  - `app/api/admin/support/reconciliation` GET/POST (run)
  - `app/api/admin/support/export` GET
  - `app/api/admin/support/foundations` GET
- Optional thin UI stubs under `/insightbooks/support/handoffs`, `reports`, `foundations` if cheap — otherwise API + My Work already enough; prefer small pages matching CS foundations pattern
- Docs (required):
  - `docs/admin-intelligence-crm/phase-10/FINAL_PHASE_10_REPORT.md`
  - `docs/admin-intelligence-crm/phase-10/PHASE_11_INPUTS.md`
  - Update `docs/admin-intelligence-crm/phase-10/README.md` wave statuses
- Exit decision in FINAL report: **`READY_FOR_PHASE_11_WITH_BLOCKERS`** listing deferred email/WhatsApp/portal/full KB/CSAT/Android etc.
- Tests: `test/systemAdmin.support.handoffs.test.js`, `test/systemAdmin.support.reconciliation.test.js` (and foundations/export if non-trivial); keep Waves 1–3 green

**Do NOT:** mutate billing/MRA/Tenant GL; invent CSAT; implement full email ingest; AI replies; revive CoA admin.

## Handoff rules

| Target | Allowed payload | Forbidden |
|--------|-----------------|-----------|
| CS | ticketId, tenantId, optional csCaseId link, summary | Opening/closing CsCase as side-effect unless explicit separate CS API call documented as out of scope — **Wave 4 = link record only** |
| Product | featureCode from Phase 9 catalogue (optional) | Fake adoption metrics |
| Finance / Billing | invoice/subscription **ids** only | Payment capture / plan mutation |
| MRA | safe transmission/fiscal **ids** only | Credentials / raw MRA payloads |

## Reconciliation / export

- Gate states: AVAILABLE | PARTIAL_HISTORY | RECONCILIATION_FAILED | NOT_INSTRUMENTED | PERMISSION_RESTRICTED | UNAVAILABLE
- Export requires `systemAdmin.support.export`; empty result ≠ invent rows
- Recon requires `runReconciliation`

## Phase docs

FINAL_PHASE_10_REPORT must include: what shipped, tests, blockers, exit status, hard-rule confirmation.  
PHASE_11_INPUTS: consumer expectations for next phase (likely ops/automation/portal/email) without inventing Phase 11 scope beyond handoff.

## Global Constraints (binding)

- Support Ticket ≠ CsCase ≠ Platform Incident ≠ CRM Lead.
- Public ≠ internal ≠ restricted notes (API-enforced).
- No billing/MRA fiscal/Tenant GL mutation from Support.
- SLA deterministic; ack ≠ human first response by default.
- No fabricated tickets/CSAT; no false zeroes; no AI replies.
- Email/WhatsApp/portal deferred.
- CoA admin route stays removed.
- **Do not git commit.** WORKING_TREE only.

## Acceptance

- [ ] Handoffs link-only; no source mutation
- [ ] Exit READY_FOR_PHASE_11_WITH_BLOCKERS documented
- [ ] Related vitest PASS (+ prior support suites green)
