# Task 3 Review — Phase 19 Wave 3 (Champions / dormancy / Phase 8 interventions / expansion)

**Reviewer:** defect-first gate (re-review AFTER fix)  
**Date:** 2026-07-31  
**Base / Head:** WORKING_TREE  
**Brief / report / package:** `task-3-brief-p19.md` / `task-3-report-p19.md` / `task-3-review-package-p19.diff`  
**Spec/Plan:** `docs/superpowers/plans/2026-07-31-customer-adoption-phase-19.md` Task 3 + Global Constraints  
**Vitest (live re-run):** `npx vitest run test/systemAdmin.cs.adoptionWave1.test.js test/systemAdmin.cs.adoptionWave2.test.js test/systemAdmin.cs.adoptionWave3.test.js` → **42/42 PASS**

---

## LIVE gate checks (post-fix)

| Gate | Live evidence | Verdict |
|------|---------------|---------|
| RECOVERED needs evidence | `attestDormancyOutcome` blocks without usage-return / outreach; HTTP forwards evidence fields; `RECOVERED_EVIDENCE_REQUIRED` | ✅ |
| Analytics missing ≠ healthy zero | Explicit `analyticsAvailable: false` → UNAVAILABLE. **Live path** (no inject): `phase9AnalyticsFactPlaneAvailable` probes `analyticsFactProductUsage.findMany` + `productFirstValueFact.findUnique` before `evaluateProductSignalsForTenant`; missing → `status: UNAVAILABLE`, `totalRiskCount: null`, `healthyEmpty: false`, `reasonCode: phase9_fact_plane_unavailable`. HTTP GET strips client injects. Vitest covers GET-shaped call | ✅ Important cleared |
| No billing/entitlement/GL from expansion | `expansion.js` only mutates `customerAdoptionExpansionHandoff`; `RECORD_ONLY_META` all mutate flags false; Vitest billing mocks unused | ✅ |
| Intervention real Phase 8 id | `linkPhase8Intervention` requires `csIntervention.findUnique` hit; missing → `intervention_not_found` | ✅ |
| planAccess on writes | champion upsert, dormancy open/attest, intervention link, expansion create/hand_off/ack all call `loadAdoptionPlanForActor`; cross-tenant denied | ✅ |
| No fabricated champion scores | Domain rejects score fields; HTTP omits; serializer has no score | ✅ |
| Idempotent expansion + P2002 race | Sequential find-before-create replay ✅. Create wrapped in try/catch; `P2002` + matching `idempotencyKey` → re-fetch + `idempotentReplay` / `alreadyExists` (Wave 1 pattern). Vitest forces pre-check miss + unique throw | ✅ Important cleared |

---

## Spec compliance: ✅

| Brief / global rule | Verdict |
|---------------------|---------|
| Contact-verified champion; no engagement score | ✅ |
| Dormancy queue Phase 9 inactive-class; UNAVAILABLE if analytics missing | ✅ live + explicit flags |
| RECOVERED requires usage-return and/or attested outreach | ✅ |
| Phase 8 intervention link-by-id only | ✅ |
| Expansion DRAFT→HANDED_OFF→ACKNOWLEDGED; no billing mutate | ✅ |
| Exact retry same expansion key → same handoff; planAccess on writes | ✅ sequential + concurrent P2002 |
| Vitest Wave 1+2+3 GREEN | ✅ 42/42 |

---

## Prior findings disposition

### Critical (was 0)

None.

### Important (was 2) — fixed

1. ~~Live dormancy queue fail-open when Phase 9 fact plane missing~~ — `listDormancyRiskQueue` probes fact/first-value delegates on live path; returns UNAVAILABLE with `healthyEmpty: false` / `totalRiskCount: null`. Covered by live GET-shaped Vitest (no `analyticsAvailable` / signal inject).
2. ~~Expansion create lacks P2002 race recovery~~ — catch unique violation → find by `idempotencyKey` → same handoff + `idempotentReplay`. Covered by concurrent race Vitest.

---

## Strengths

1. RECOVERED evidence gate is real and HTTP-reachable.
2. Expansion is record-only with explicit meta flags; billing mocks never called.
3. Phase 8 link requires existing `CsIntervention` id (no engine rebuild).
4. Live dormancy honesty no longer depends on Phase 9 signals silently returning `ok: true` + `[]` when models are absent.
5. All Wave 3 writes gate via `loadAdoptionPlanForActor`; Wave 1–3 regression green (42/42).

---

## Task quality: Approved with notes

### Critical findings

None.

### Important findings

None.

### Minor notes (non-blocking)

1. Domain accepts injected signals when `analyticsAvailable === true && Array.isArray(signals)` without `allowTestSignalInject`; HTTP GET correctly strips injects — keep that invariant.
2. Creator≠acknowledger SoD is opt-in (`enforceCreatorAckSoD: true`); default soft — confirm intentional.
3. `upsertAdoptionChampion` treats broad `contact.status === 'APPROVED'` as verified — OK if CRM verificationStatus is primary.
4. Prisma generate / db push may still hit Windows EPERM; SQL + `hasModel` UNAVAILABLE guards remain (reported).
5. Probe is delegate-presence based (not a live query health check); if both delegates exist but reads fail, catch → `signals_read_failed` UNAVAILABLE — acceptable.

---

## Verdict

- **Spec compliance:** ✅  
- **Task quality:** Approved with notes  
- **Critical:** 0  
- **Important:** 0  
- **Gate:** Wave 4 unblocked for Task 3; minors optional follow-ups.
