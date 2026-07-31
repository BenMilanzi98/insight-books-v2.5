# Phase 11 Final Report — CRM Core Foundation

**Decision:** **READY_FOR_PHASE_12_WITH_BLOCKERS**

**Date:** 2026-07-30

**Working tree:** Phase 11 Waves 0–4 delivered in-place on branch `v2` (no git commit required for Wave 4 exit).

CRM Core is shippable for authorised System Admin users as a **dedicated CrmLead / CrmAccount / CrmContact plane** (≠ Customer ≠ SupportTicket ≠ CsCase ≠ Tenant Client ≠ POS `sales.*`): numbering + state machine, idempotent public/handoff capture, duplicate candidates, versioned qualification, deterministic explainable scoring (not probability/Revenue), teams/territories/assignment, consent/DNC eligibility, timeline/notes/tasks foundations, controlled merge with SoD, opportunity-readiness handoff payload (**never creates Opportunity**), My Work / lead list / lead detail UI, and import/report/Email/WhatsApp foundation contracts.

## Delivered

| Wave | Focus | Status |
|------|-------|--------|
| 0 | Forensic audits + matrices + CONDITIONAL GO | Done |
| 1 | Account / Contact / Lead + numbering + status SM + APIs | Done |
| 2 | Public capture + handoffs → Lead + duplicate candidates | Done |
| 3 | Qualification + scoring + ownership/territories + consent/DNC | Done |
| 4 | Timeline/tasks/notes + merge + readiness + UI + Phase 12 pack | Done |

## Surfaces (Wave 4)

### Libraries

- `lib/admin/crm/timeline.js` — paginated timeline events (≠ Support/CS threads)
- `lib/admin/crm/notes.js` — INTERNAL / RESTRICTED notes; restricted projection API-enforced
- `lib/admin/crm/tasks.js` — TODO → COMPLETED only (no sales sequences)
- `lib/admin/crm/merge.js` — request / approve / execute; SoD requester ≠ approver; evidence preserved
- `lib/admin/crm/opportunityReadiness.js` — checklist → NOT_READY|PARTIALLY_READY|READY|BLOCKED; typed handoff; **never creates Opportunity**
- `lib/admin/crm/reconciliation.js`, `export.js`, `foundations.js` — light recon/export; FOUNDATION / NOT_AVAILABLE honesty

### Prisma / SQL

- `CrmTimelineEvent`, `CrmNote`, `CrmTask`, `CrmMergeRequest`, `CrmReconciliationRun`, `CrmExportAudit`
- `CrmLead.mergedIntoLeadId`
- Fallback: `scripts/sql/crm-core-phase11-wave4.sql`

### APIs

- Timeline / notes / tasks (+ complete)
- Merge request / approve / execute
- Opportunity readiness (POST)
- Reconciliation / export / foundations

### UI

- `/insightbooks/crm` → My Work; lead list + detail; thin stubs for accounts/contacts/duplicates/imports/settings
- Reports + foundations views; section nav + i18n (en/ny)
- Channel badges: EMAIL / WHATSAPP = NOT_AVAILABLE
- Score copy: “Lead fit score” — never probability

## Hard rules preserved

- Lead ≠ Opportunity ≠ Customer ≠ Support Ticket ≠ CsCase
- CRM Account may link to Customer; must not duplicate billing/MRR truth
- Contact ≠ Platform User
- Capture idempotent; consent never inferred; DNC via eligibility
- Qualification ≠ scoring; score ≠ win probability; no AI scoring
- No silent merges; SoD on merge approval
- Email / WhatsApp Lead ingest remain `NOT_AVAILABLE` + contracts
- Tenant POS `sales.*` is WRONG_DOMAIN
- System CoA admin route stays removed

## Verification

```bash
npx vitest run \
  test/systemAdmin.crm.wave4.test.js \
  test/systemAdmin.crm.qualification.test.js \
  test/systemAdmin.crm.scoring.test.js \
  test/systemAdmin.crm.assignment.test.js \
  test/systemAdmin.crm.consent.test.js \
  test/systemAdmin.crm.leads.test.js \
  test/systemAdmin.crm.capture.test.js \
  test/systemAdmin.crm.duplicates.test.js
```

**Result (2026-07-30):** Test Files 8 passed (8) · Tests 60 passed (60)

## Known blockers for Phase 12

1. **Email → Lead ingest** — channel contract `NOT_AVAILABLE` (no invented inbound volume)
2. **WhatsApp → Lead ingest** — deferred; same honesty gate
3. **Full CRM import tooling** — FOUNDATION only; no fake import success metrics
4. **Full CRM reporting / dashboards** — FOUNDATION; export JSON/CSV only
5. **Opportunity / Pipeline / forecasting / proposals** — NOT_AVAILABLE in Phase 11 create scope; readiness handoff only
6. **Lead → Tenant conversion transaction** — CARRY (human Tenant create today)
7. **Account/Contact merge UI depth** — Lead merge executed; Account/Contact merge deferred (`NOT_AVAILABLE`)
8. **Rich Accounts/Contacts/Duplicates admin UI** — thin stubs; APIs exist
9. **Owner/team/territory list scope filtering** — `resolveCrmScope` still `mode: 'all'` stub
10. **Prisma generate / db push on Windows** — schema + SQL ready; apply when EPERM clears

## Exit readiness

**READY_FOR_PHASE_12_WITH_BLOCKERS** — CRM Core Waves 1–4 are honest and gated for capture, qualification, scoring, ownership, consent, merge SoD, opportunity-readiness handoff, and admin My Work/list/detail; Email/WhatsApp ingest, full import/reporting, and Opportunity create remain explicit blockers for treating CRM as revenue-pipeline-complete.
