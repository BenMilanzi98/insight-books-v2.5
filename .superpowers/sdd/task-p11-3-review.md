# Task P11-3 Review — Wave 3 qualification + scoring + assignment + consent (re-review)

**Scope:** Phase 11 Task 3 only (brief / report / WORKING_TREE + review package)  
**Mode:** Read-only spec + quality review  
**Date:** 2026-07-30  
**Prior review:** P2 findings addressed in fix pass (report §Fix pass)  
**Vitest (re-run):** 7 files, 51 tests passed

## P2 fix verification (requested)

| Finding | Status | Evidence |
|---------|--------|----------|
| `evaluateQualification` finds lead before persist | **Fixed** | `lib/admin/crm/qualification/evaluate.js:249-260` — `findLead` + `lead_not_found` return precede `persistResponses`; comment documents intent. Test `does not persist qualification responses when lead is missing` asserts `notFound`, empty `_responseStore`, no upsert/create calls. |
| `canScoreLeads` does not grant via `viewLeads` alone | **Fixed** | `lib/admin/crm/authz.js:96-97` — `canScoreLeads: Boolean(isSuper \|\| scoreLeads.allowed \|\| editLeads.allowed)`; `viewLeads` excluded. `runLeadScore` gates on `canScoreLeads` (`engine.js:217-219`). Test `forbids running/persisting scores with viewLeads alone` asserts `canScoreLeads === false`, `crm_score_forbidden`, zero eval rows. |

No remaining actionable defects from the prior review.

## Verify checklist (requested)

| Check | Status | Evidence |
|-------|--------|----------|
| UNKNOWN ≠ NO | **Met** | `evaluateQualificationResponses`: required UNKNOWN / PENDING_VERIFICATION → `required_unknown`; NO only when `blockingNo`; `summary.unknownIsNotNo: true`. Test covers UNKNOWN vs blocking NO. |
| Score not probability | **Met** | `isProbability: false` / `isExpectedRevenue: false`; `displayLabel` = “Lead fit score”; `assertScoreLabelSafe` + `CRM_SCORE_FORBIDDEN_LABELS`. |
| Contributions + confidence | **Met** | `computeScore` emits per-dimension contributions; missing → `rawValue: null`, lower confidence (no invented values); persist contributions on run. |
| Assignment noop | **Met** | Same `ownerAdminId` + `teamId` → `{ noop: true }` with no history append; reassign writes `REASSIGN`. |
| DNC blocks eligibility | **Met** | `checkCommunicationEligibility`: channel DNC + `DO_NOT_CONTACT_ALL` block; GRANTED never inferred; UNKNOWN/DENIED/WITHDRAWN block. |
| Versioned defs | **Met** | Pinned catalogue `qual-small-business-standard-v1` / `score-lead-fit-v1`; resolve-by-versionId; unknown version → `DEFINITION_MISSING` (no invented newer default); evals/responses pin `definitionVersionId`. |

## Acceptance checklist

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Versioned qualification; UNKNOWN ≠ NO | **Met** | Catalogue + evaluate + gate on `transitionLeadStatus` → QUALIFIED |
| Deterministic score + contributions + confidence; not probability | **Met** | Engine + tests; forbidden labels |
| Assignment history; no silent reassign loops | **Met** | History on change; same owner+team noop; accept/reject/return-to-queue |
| Consent source-traceable; DNC blocks eligibility | **Met** | `source` required on record/DNC; eligibility gate |
| Vitest PASS (+ prior CRM suites green) | **Met** | Re-run: 7 files / 51 tests passed |

## Global constraints

| Constraint | Status |
|------------|--------|
| Lead ≠ Opportunity ≠ Customer ≠ Ticket ≠ CsCase | OK — no Opportunity create |
| Consent never inferred; DNC enforced | OK — fail-closed UNKNOWN; eligibility gate |
| Scoring deterministic, versioned, explainable — not probability/Revenue | OK |
| No silent merges; no AI scoring/messages | OK |
| No fabricated Leads/Contacts/consent; no false zeroes | OK for Wave 3 shape (missing dims do not invent `rawValue`) |
| Email/WhatsApp ingest deferred | OK |
| CoA not reintroduced | OK |
| No commit | OK — WORKING_TREE |

## Spec coverage (brief)

Qualification / scoring modules, teams / territories / assignment, consent / eligibility, catalogue+authz+index+leads QUALIFIED gate, permissions, Prisma models + SQL fallback, admin APIs (evaluate / scoring/run / assign / consent / eligibility / teams / territories), Vitest suites: **present** in WORKING_TREE.

**Review package gap:** `task-p11-3-review-package.diff` omits Prisma, catalogue/authz/index/leads, permissions, tests, and `scoring/run` route — reviewed those from WORKING_TREE against brief/report.

## Overall assessment

Wave 3 shape matches the brief: versioned qualification with UNKNOWN ≠ NO, deterministic explainable scoring (not probability), assignment history with same-owner noop, and a fail-closed consent/DNC eligibility gate. Both prior P2 defects are resolved with targeted tests. Vitest green including Wave 1–2 regression (51 tests).

**Residual risks (non-blocking):** QUALIFIED soft-skip when response model absent; catalogue territories lack default owner/team so TERRITORY_BASED needs caller `ownerAdminId` / team members; scope still `mode: 'all'`; no HTTP route tests.

**Task quality:** Approved
