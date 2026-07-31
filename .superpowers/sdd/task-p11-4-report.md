# Task P11-4 Report — Wave 4 Timeline/tasks/notes + merge + readiness + UI + Phase 12 pack

**Branch:** `v2`  
**Workspace:** in-place WORKING_TREE (no git commit)  
**Date:** 2026-07-30  
**Status:** COMPLETE — exit **READY_FOR_PHASE_12_WITH_BLOCKERS**

## Summary

Implemented Phase 11 Wave 4: paginated CRM timeline; INTERNAL/RESTRICTED notes with restricted projection; TODO→COMPLETED tasks; controlled Lead merge (request/approve/execute) with SoD (requester ≠ approver) and evidence preservation; opportunity readiness checklist + typed handoff payload that **never creates Opportunity**; recon/export/foundations honesty stubs; `/insightbooks/crm` My Work + lead list/detail UI (Support/CS patterns); en/ny i18n; Phase 12 pack docs. Prior CRM Wave 1–3 tests remain green.

## Deliverables

| Area | Path / change |
|------|----------------|
| Timeline / notes / tasks | `lib/admin/crm/{timeline,notes,tasks}.js` |
| Merge SoD | `lib/admin/crm/merge.js` |
| Opportunity readiness | `lib/admin/crm/opportunityReadiness.js` |
| Recon / export / foundations | `lib/admin/crm/{reconciliation,export,foundations}.js` |
| Catalogue / authz / index | Wave 4 constants + merge/export/note gates |
| Prisma | Timeline/Note/Task/MergeRequest/ReconRun/ExportAudit; `CrmLead.mergedIntoLeadId` |
| SQL fallback | `scripts/sql/crm-core-phase11-wave4.sql` |
| APIs | timeline, notes, tasks, merge (+approve/execute), opportunity-readiness, recon, export, foundations |
| UI | `app/insightbooks/crm/**` + `components/admin/crm/**` |
| Nav / i18n | `crmNav.js`; locales en/ny admin-shell + admin-pages |
| Docs | `FINAL_PHASE_11_REPORT.md`, `PHASE_12_INPUTS.md`, README wave statuses |
| Tests | `test/systemAdmin.crm.wave4.test.js` (+ Waves 1–3 regression) |

## Acceptance checklist

- [x] Merge SoD; evidence preserved
- [x] Opportunity readiness does not create Opportunity
- [x] Exit READY_FOR_PHASE_12_WITH_BLOCKERS documented
- [x] Related vitest PASS (+ prior CRM suites green)

## Test summary

```
npx vitest run test/systemAdmin.crm.wave4.test.js \
  test/systemAdmin.crm.qualification.test.js \
  test/systemAdmin.crm.scoring.test.js \
  test/systemAdmin.crm.assignment.test.js \
  test/systemAdmin.crm.consent.test.js \
  test/systemAdmin.crm.leads.test.js \
  test/systemAdmin.crm.capture.test.js \
  test/systemAdmin.crm.duplicates.test.js

Test Files  8 passed (8)
Tests       60 passed (60)
```

## Self-review

- No Opportunity/Pipeline/Revenue invent; CONVERTED_TO_OPPORTUNITY still blocked in state machine.
- Merge self-approval returns `SOD_VIOLATION`; loser → MERGED with history + `mergedIntoLeadId`; duplicate candidates updated.
- Restricted notes omitted for viewLeads-only admins.
- EMAIL/WHATSAPP channel badges and foundations contracts remain NOT_AVAILABLE.
- No git commit (WORKING_TREE).

## Concerns / follow-ups (non-blocking)

1. **Prisma generate / db push** — schema + SQL ready; apply when Windows EPERM clears. Model guards → UNAVAILABLE until then.
2. **Account/Contact merge** — request returns NOT_AVAILABLE; Lead merge is the Wave 4 path.
3. **Rich Accounts/Contacts/Duplicates UI** — intentional thin stubs; APIs exist from prior waves.
4. **Scope filtering** — `resolveCrmScope` still `mode: 'all'` stub for list filtering.

## Fix pass

**Date:** 2026-07-30  
**Trigger:** `task-p11-4-review.md` P1/P2 findings  
**Status:** FIXED (WORKING_TREE, no git commit)

### Changes

1. **P1 — eligibility gate** (`lib/admin/crm/opportunityReadiness.js`): `consent_eligibility` checklist `ok` / blocker now derived from `eligibilityOk` (full Wave 3 eligibility: EXPIRED/PENDING/UNKNOWN/DENIED/WITHDRAWN + DNC). READY is no longer reachable on partial consent checks.
2. **P2 — score version honesty**: handoff `scoreVersionId` is `null` when no evaluation exists (removed `CRM_DEFAULT_SCORE_VERSION_ID` invent).
3. **P2 — score UI**: `getLatestLeadScore` + `GET /api/admin/crm/scoring?leadId=`; lead detail shows fit score, **confidence**, and **dimension contributions**; missing/unavailable states use insufficient/unavailable copy (never probability labels).

### Tests

```
npx vitest run test/systemAdmin.crm.wave4.test.js \
  test/systemAdmin.crm.scoring.test.js \
  test/systemAdmin.crm.consent.test.js

Test Files  3 passed (3)
Tests       23 passed (23)
```

Added coverage: EXPIRED + DNC → not READY; handoff `scoreVersionId` null without evaluation; `getLatestLeadScore` dimensions/confidence or INSUFFICIENT.
