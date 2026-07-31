### Task 4: Wave 4 — Timeline/tasks/notes + merge + readiness + UI + Phase 12 pack

**Depends on:** Waves 1–3 CRM (WORKING_TREE).

**Files (create / extend):**
- `lib/admin/crm/timeline.js`, `notes.js`, `tasks.js` — foundations (paginated timeline; notes with INTERNAL/RESTRICTED; tasks TODO→COMPLETED; no full sales sequences)
- `lib/admin/crm/merge.js` — merge request / approve / execute for Leads (and Contact/Account if cheap); **SoD: requester ≠ approver**; preserve evidence; no silent merge
- `lib/admin/crm/opportunityReadiness.js` — checklist → NOT_READY|PARTIALLY_READY|READY|BLOCKED; build typed handoff payload; **never create Opportunity**
- `lib/admin/crm/reconciliation.js`, `export.js`, `foundations.js` — light recon/export stubs; import/report FOUNDATION / NOT_AVAILABLE honesty
- Prisma + SQL `scripts/sql/crm-core-phase11-wave4.sql` as needed
- UI under `app/insightbooks/crm/**`:
  - `page.js` / `overview` / `my-work`
  - `leads/page.js`, `leads/[leadId]/page.js` (status, score summary, qualification, consent, readiness — follow Support/CS patterns)
  - Thin stubs OK for accounts/contacts/duplicates/imports/reports/settings if list+detail for leads/my-work are solid
- Nav + i18n en/ny for CRM section
- Docs: `docs/admin-intelligence-crm/phase-11/FINAL_PHASE_11_REPORT.md`, `PHASE_12_INPUTS.md`, update README wave statuses; exit **`READY_FOR_PHASE_12_WITH_BLOCKERS`**
- Tests: merge SoD, readiness no Opportunity, timeline pagination, notes restricted projection; keep Waves 1–3 green

**Do NOT:** create Opportunity/Pipeline; ML; Email/WhatsApp ingest; fabricate metrics zeroes; revive CoA admin.

## Merge

- Select survivor; preserve source IDs, status/score/consent history references
- Self-approval blocked
- Duplicate candidate state updates on merge

## Opportunity readiness

- Requires: qualified, account+primary contact linked (or documented exception), product interest known OR explicit unknown allowed by checklist, duplicate review not CRITICAL open, consent/eligibility known (UNKNOWN is visible blocker for READY)
- Payload includes lead/account/contact ids, source, score version, qualification version, idempotency key
- Status OPPORTUNITY_READY only when READY — do not invent Revenue

## UI

- Match AdminShell / Support My Work patterns
- Server-paginated lead list; mobile-friendly cards if CS pattern exists
- Score explanation shows dimensions + confidence — never “probability”
- Channel badges: EMAIL/WHATSAPP NOT_AVAILABLE

## Global Constraints

Phase 11 plan constraints. **Do not git commit.** WORKING_TREE.

## Acceptance

- [ ] Merge SoD; evidence preserved
- [ ] Opportunity readiness does not create Opportunity
- [ ] Exit READY_FOR_PHASE_12_WITH_BLOCKERS documented
- [ ] Related vitest PASS (+ prior CRM suites green)
