# Task P11-3 Report — Wave 3 Qualification + scoring + ownership/territories + consent/DNC

**Branch:** `v2`  
**Workspace:** in-place WORKING_TREE (no git commit)  
**Date:** 2026-07-30  
**Status:** COMPLETE (acceptance criteria met; Vitest green)

## Summary

Implemented Phase 11 Wave 3: versioned qualification (UNKNOWN ≠ NO), deterministic 0–100 scoring with contributions/confidence/critical caps (never probability/Revenue), sales teams/territories/assignment history (MANUAL + ROUND_ROBIN + TERRITORY_BASED; accept/reject/return-to-queue; same owner+team noop), and source-traceable consent/DNC with `checkCommunicationEligibility` gate. Follows Support SLA versioning pins and CRM Wave 1 authz. No Opportunities created. Prior CRM Wave 1–2 tests still pass.

## Deliverables

| Area | Path / change |
|------|----------------|
| Qualification | `lib/admin/crm/qualification/{catalogue,definitions,evaluate,index}.js` |
| Scoring | `lib/admin/crm/scoring/{catalogue,definitions,engine,index}.js` |
| Teams / territories / assignment | `lib/admin/crm/teams.js`, `territories.js`, `assignment.js` |
| Consent / eligibility | `lib/admin/crm/consent.js`, `eligibility.js` |
| Catalogue / authz / index | `catalogue.js`, `authz.js`, `index.js`; `leads.js` QUALIFIED gate + ownership fields |
| Permissions | `qualifyLeads`, `scoreLeads`, `overrideQualification`; wired `assignLeads`, `manageConsent` |
| Prisma | Qualification/score defs+versions+responses/evals/contributions; sales team/member; territory/rule; assignment history; consent; comm prefs; DNC; Lead `teamId`/`territoryId`/`assignedAt`/`acceptedAt` |
| SQL fallback | `scripts/sql/crm-core-phase11-wave3.sql` |
| Admin APIs | `qualification/evaluate`, `scoring/run`, `assign`, `consent`, `eligibility`, `teams`, `territories` |
| Tests | `qualification`, `scoring`, `assignment`, `consent` (+ Wave 1–2 regression) |

## Behaviour notes

- **Qualification:** ACTIVE `SMALL_BUSINESS_STANDARD` catalogue version; responses YES\|NO\|PARTIAL\|UNKNOWN\|NOT_APPLICABLE\|PENDING_VERIFICATION; cannot QUALIFY with required UNKNOWN or blocking NO; override needs `overrideQualification` + reason; soft-skip QUALIFIED gate when response model unavailable (EPERM / pre-migrate).
- **Scoring:** Pinned `score-lead-fit-v1`; missing dims lower confidence (no invented values); DNC/SPAM/COMPLIANCE_BLOCK cap to 0/BLOCKED; evaluations append-only; forbidden labels rejected.
- **Assignment:** Same owner+team → noop (no history spam); ambiguous territory → `TERRITORY_AMBIGUOUS` visible failure; history on every ownership change.
- **Consent/DNC:** GRANTED never inferred; UNKNOWN/DENIED/WITHDRAWN/EXPIRED/PENDING + channel/all DNC block eligibility.

## Acceptance checklist

- [x] Versioned qualification; UNKNOWN ≠ NO
- [x] Deterministic score + contributions + confidence; not probability
- [x] Assignment history; no silent reassign loops
- [x] Consent source-traceable; DNC blocks eligibility
- [x] Vitest PASS (+ prior CRM suites green)

## Test summary

```
npx vitest run test/systemAdmin.crm.qualification.test.js \
  test/systemAdmin.crm.scoring.test.js \
  test/systemAdmin.crm.assignment.test.js \
  test/systemAdmin.crm.consent.test.js \
  test/systemAdmin.crm.leads.test.js \
  test/systemAdmin.crm.capture.test.js \
  test/systemAdmin.crm.duplicates.test.js

Test Files  7 passed (7)
Tests       49 passed (49)
```

## Self-review

- No Opportunity create / ML scoring / auto outbound / Email-WhatsApp ingest / silent merge.
- Score API contract sets `isProbability: false` / `isExpectedRevenue: false`; displayLabel = “Lead fit score”.
- Definition versions pinned as strings (SLA pattern) — catalogue works without DB seed rows.
- Unrelated Phases left untouched; no git commit.

## Concerns / follow-ups (non-blocking)

1. **Prisma generate / db push** — schema + SQL ready; operators should apply when EPERM clears. Until then, model guards → UNAVAILABLE / catalogue stubs.
2. **QUALIFIED soft-skip** — when `crmQualificationResponse` client missing, status transition to QUALIFIED is not gated (preserves Wave 1 mocks / pre-migrate). Enforce once model is generated.
3. **Territory/team on Lead** — stored as opaque strings (id or code); no FK so catalogue stubs do not break assigns.
4. **Scope filtering** — `resolveCrmScope` still `mode: 'all'` for viewers; real owner/team/territory list filters remain later ops work.

## Fix pass

**Date:** 2026-07-30  
**Scope:** P2 findings from `task-p11-3-review.md`  
**Status:** FIXED (no git commit)

### Changes

1. **`evaluateQualification`** (`lib/admin/crm/qualification/evaluate.js`) — `findLead` + `lead_not_found` now run **before** `persistResponses`, so missing leads never write orphan `CrmQualificationResponse` rows.
2. **`canScoreLeads`** (`lib/admin/crm/authz.js`) — requires `scoreLeads || editLeads` (or super); **`viewLeads` alone no longer authorizes** score run/persist. Viewing history may still use view separately.

### Tests added

- Qualification: missing lead → `notFound` / no upsert/create calls / empty response store.
- Scoring: `viewLeads`-only admin → `crm_score_forbidden`; no evaluation rows persisted.

### Vitest (fix pass)

```
npx vitest run test/systemAdmin.crm.qualification.test.js \
  test/systemAdmin.crm.scoring.test.js \
  test/systemAdmin.crm.assignment.test.js \
  test/systemAdmin.crm.consent.test.js

Test Files  4 passed (4)
Tests       24 passed (24)
```
