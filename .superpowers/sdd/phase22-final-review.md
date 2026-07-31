# Phase 22 Final Whole-Branch Review — Customer Training (PRD 22)

**Reviewer:** SDD final whole-branch re-review subagent  
**Date:** 2026-07-31  
**Mode:** Defect-first (WORKING_TREE; write review/fix/progress artifacts only)  
**BASE_SHA:** `7d9709a897bc0d4609ce8a6725aad7d9cf1cb835` (WORKING_TREE — no Phase 22 commits)  
**Canonical:** `lib/admin/customerSuccess/training/**`  
**Docs:** `docs/admin-intelligence-crm/phase-22/**`  
**Spec/plan:** `docs/superpowers/specs/2026-07-31-customer-training-phase-22-design.md` + plan  
**SDD prior:** Tasks 0–4 reports/reviews/fix-reports; Task 4 Important #1–#2 cleared; final review Important #1–#2 remediations CLEARED  
**Claimed exit:** `READY_FOR_PHASE_23_WITH_BLOCKERS`

## Verdict

**Approved with notes.**  
Prior Important #1–#2 verified fixed in `progress.js` + `reports.js` with Wave4 regressions. Tree-18 ≡ PRD 22 hardening remains honest. No Critical/Important remaining from this final gate. Exit **ratified**.

## Vitest (LIVE re-run post-fix)

```text
npx vitest run \
  test/systemAdmin.cs.trainingPhase22Wave1.test.js \
  test/systemAdmin.cs.trainingPhase22Wave2.test.js \
  test/systemAdmin.cs.trainingPhase22Wave3.test.js \
  test/systemAdmin.cs.trainingPhase22Wave4.test.js \
  test/systemAdmin.cs.trainingWave4.test.js

 Test Files  5 passed (5)
      Tests  53 passed (53)
```

Baseline at first final review: 51. Post-Important remediations: **53** (+2 Wave4 regressions). Claims honest.

## Must-verify checklist (LIVE)

| Focus | Result |
|-------|--------|
| Tree-18 Training ≡ PRD 22; no second Training domain | **PASS** — only `lib/admin/customerSuccess/training/**`; contract `phase:22` / `treePhaseAlias:18` / `wave:4` |
| Demo PRD 18 preserved | **PASS** — `lib/admin/crm/demos/**` intact; phase-18 README banners Demo≠Training |
| Onboarding / Adoption not absorbed/deleted | **PASS** — folders present; Adoption quarantined |
| Phase 21 handoff checksum → Request/Program spine honesty | **PASS** — missing checksum UNKNOWN≠VALID; accept refuses UNKNOWN; accept `programCreated: false` |
| Invitation ≠ attendance | **PASS** — allowlist + forbidden sources → `ATTENDANCE_TRUTH_RISK` |
| Superseded attendance not counted (completion/cert) | **PASS** — `completion.js` filters `!supersededById`; Wave3 regression |
| Superseded / cross-program attendance not counted (progress) | **PASS** — `progress.js` current projection + session→program; Wave4 regression |
| Cert UNKNOWN ≠ issue | **PASS** — refuse `certificate_eligibility_UNKNOWN_cannot_issue` |
| CS handoff no Health overwrite | **PASS** — no `customerHealth` write; meta flags false |
| PA source-labelled only; ≠ marketing / auto Leads | **PASS** — refuses Leads / PE / marketingAttribution flags |
| Metrics/DQ/recon/report fail-closed; invent-zero / lineageIntact | **PASS** — metrics/DQ/recon/search/export + `getTrainingReport` scope fail-closed |
| Progress ≠ completion ≠ adoption; Phase 23 pack honest; exit recorded | **PASS** — honesty labels + pack + exit docs OK; progress projection corrected |
| No Production accounting/MRA fiscal from Training | **PASS** — fiscal gate always asserted; forbidden planes refused |
| System CoA stays removed | **PASS** — `app/insightbooks/chart-of-accounts/page.js` redirects removed notice |
| Vitest Waves 1–4 (+ tree Wave 4) honest | **PASS** — LIVE 53/53 |

## Issues

### Critical

None.

### Important

None remaining (prior #1–#2 cleared — verified this re-run).

1. ~~**`calculateTrainingProgress` counts superseded and cross-program attendance`**~~ — **FIXED** — `progress.js` excludes `supersededById` and constrains PRESENT* to sessions for requested `programId`. Wave4: `progress excludes superseded and cross-program attendance`.

2. ~~**`getTrainingReport` fails open without portfolio/tenant scope`**~~ — **FIXED** — `reports.js` uses `resolveTrainingListScope` + `tenantWhereFromScope`; scope fail → `UNAVAILABLE` / `report: null` / `meta.failClosed`. Wave4: `getTrainingReport portfolio fail-closed; scoped counts only`.

### Minor

1. Export model-unavailable omits `rows`/`body: null` (Task 4 residual) — `exports.js` UNAVAILABLE path incomplete vs query-fail.  
2. Attempt answer-key assertion soft-skipped when `attempts.ok` false (Wave4 test).  
3. Sibling hub/page comments still say “Phase 18” in places; Overview hardcodes English honesty prose while EN/NY keys exist unused.  
4. Delivery/attendance/restricted-download evidence often shape-only (Task 2–3 residuals).  
5. Enrolment same-key replay skips input conflict compare; CS/PA coverage fields trust caller input (prior Minors).  
6. G22-16/17/20/21 (question-bank/appeals, competency distinct, feedback/quality, refresher) correctly open under WITH_BLOCKERS — not defects if not claimed closed.

## Exit ratification

**Yes** — `READY_FOR_PHASE_23_WITH_BLOCKERS` ratified. Critical 0 · Important 0 remaining from final whole-branch review. Vitest LIVE 53/53.

Documented Phase 23 blockers (portal, payment/e-sign, migration, MRA fiscal, virtual provider, marketing-consent SoT, lineage instrumentation) remain appropriate under WITH_BLOCKERS.

## Assessment

Waves 0–4 deliver a coherent single Training plane with strong Wave 1–3 truth gates and fail-closed Wave 4 reliability surfaces. Prior progress-projection and report-KPI Important defects are remediated with regressions. Remaining items are Minor / intentional WITH_BLOCKERS open work — not exit blockers.

**Counts:** Critical 0 · Important 0 · Minor 6  
**Exit ratification:** yes (`READY_FOR_PHASE_23_WITH_BLOCKERS`)  
**Path:** `.superpowers/sdd/phase22-final-review.md`
