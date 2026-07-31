# Task 2 Report — Phase 19 Wave 2 (Milestones / value / Phase 9 evidence / Plan completion)

**Date:** 2026-07-31  
**Status:** COMPLETE (GREEN)  
**Commit:** none (WORKING_TREE only, per brief)

---

## Summary

Implemented Phase 19 Wave 2 under `lib/admin/customerSuccess/adoption/**`: idempotent milestone materialisation from pinned template, evidence-mode evaluation (`PRODUCT_ANALYTICS` / `TRAINING_CERT` / `CS_ATTESTATION` / `MIXED`), Phase 9 read-only evidence honesty, value outcomes (null/UNAVAILABLE not false zero), Plan completion evaluation, health, SQL + Prisma models, thin APIs/UI, Vitest Wave 1+2 green.

---

## RED

```text
npx vitest run test/systemAdmin.cs.adoptionWave2.test.js

 FAIL  test/systemAdmin.cs.adoptionWave2.test.js
 TypeError: materialiseAdoptionMilestones is not a function
 …
 Test Files  1 failed (1)
      Tests  11 failed | 2 passed (13)
```

Failure mode: missing Wave 2 domain exports (expected before implementation).

---

## GREEN

```text
npx vitest run test/systemAdmin.cs.adoptionWave2.test.js test/systemAdmin.cs.adoptionWave1.test.js

 Test Files  2 passed (2)
      Tests  29 passed (29)
 Duration  ~1.43s
```

| Case | Result |
|------|--------|
| Materialise milestones from pinned template (idempotent) | PASS |
| PRODUCT_ANALYTICS gate fail → UNKNOWN + UNAVAILABLE (≠ MET) | PASS |
| TRAINING_CERT WITH_GAPS alone ≠ MET | PASS |
| TRAINING_CERT Program COMPLETED → MET | PASS |
| Attestation requires manage + planAccess | PASS |
| Critical waiver SoD (attestor ≠ sole waver) | PASS |
| Value missing → UNAVAILABLE null (≠ false zero) | PASS |
| Any-one-milestone ≠ Plan COMPLETED | PASS |
| Ungated COMPLETED transition rejected | PASS |
| All critical MET + value review → Plan COMPLETED | PASS |
| Writes use loadAdoptionPlanForActor (cross-tenant denied) | PASS |
| Health typed; never invents COMPLETED | PASS |
| Wave 1 regression (16 tests) | PASS |

---

## Deliverables

| Area | Path |
|------|------|
| Domain | `lib/admin/customerSuccess/adoption/{milestones,valueOutcomes,evidence,completion,health}.js` (+ catalogue/model/status/plans/index) |
| SQL | `scripts/sql/cs-adoption-phase19-wave2.sql` |
| Prisma | `CustomerAdoption{Milestone,EvidenceSnapshot,ValueOutcome}` |
| API | `app/api/admin/customer-success/adoption-milestones/route.js`, `adoption-value-outcomes/route.js` |
| UI | `app/insightbooks/customer-success/adoption/{milestones,outcomes}/page.js` (+ hub links) |
| Test | `test/systemAdmin.cs.adoptionWave2.test.js` |

### Interfaces shipped

- `materialiseAdoptionMilestones` — from pinned `planTemplateVersionId`; idempotent per plan/version
- `evaluateAdoptionMilestone` — PRODUCT_ANALYTICS / TRAINING_CERT / CS_ATTESTATION / MIXED
- Gate fail / missing analytics → milestone `UNKNOWN` + evidence `UNAVAILABLE` (never invent MET)
- `attestAdoptionMilestone` / `waiveAdoptionMilestone` — manage + planAccess; critical waiver SoD
- `recordAdoptionValueOutcome` — snapshot + lineage; null/UNAVAILABLE not false zero
- `signOffAdoptionValueReview` — required for Plan COMPLETED
- `evaluateAdoptionPlanCompletion` — critical MET\|WAIVED + value review + no blocking Critical DQ
- `transitionAdoptionPlanStatus` → COMPLETED blocked unless evaluation passes (or audited waiver)
- `HANDED_TO_RENEWALS` → `HANDOFF_POLICY_REQUIRED` until Wave 3
- `calculateAdoptionHealth` — typed; never invents COMPLETED
- Writes gate via `loadAdoptionPlanForActor`

---

## Out of scope (correctly deferred)

- Champions, dormancy recovery, Phase 8 intervention links, expansion handoffs (Wave 3)
- Hub polish, metrics/DQ/recon/lineage, Phase 8 projection (Wave 4)
- Tenant GL / renewals billing execute

---

## Concerns

1. **Prisma generate / db push** may hit Windows EPERM — use `scripts/sql/cs-adoption-phase19-wave2.sql` + `hasModel` guards (fail closed to UNAVAILABLE).
2. **PRODUCT_ANALYTICS MET** requires server-side Phase 9 `firstValue` / `adoption` / `signals` evidence meeting definition; gate fail or unreadable → UNKNOWN/UNAVAILABLE (never client-injected MET).
3. **Critical DQ** blocking is flag-based in Wave 2 (`blockingCriticalDq`); Wave 4 deepens DQ engine.
4. SDD review gate before Wave 3.

---

## Fix wave

**Date:** 2026-07-31  
**Trigger:** Task 2 review Critical #1–2 + Important #1–2  
**Commit:** none (WORKING_TREE only)

### Critical

1. **Strip client evidence inject / wire Phase 9 read-only** — `evidence.js` + `adoption-milestones` route  
   - HTTP `evaluate` no longer forwards `analyticsGate` / `phase9Snapshot`.  
   - `resolveProductAnalyticsEvidence` resolves MET only via server `readPhase9ProductEvidence` (`loadFirstValue`, `evaluateAdoptionState`, `evaluateProductSignalsForTenant`) behind reliability gate.  
   - Unreadable / unmet → `UNAVAILABLE` + `meetsDefinition: false`.  
   - Vitest-only inject gated by `allowTestEvidenceInject: true`.  
   - Default milestone feature/metric aligned to Phase 9 `invoices.post` / `product.feature.invoices.post.count`.

2. **Restrict `attestAdoptionMilestone`** — `milestones.js`  
   - Allowed only for `CS_ATTESTATION` (sets MET) or `MIXED` attestation leg (records `attestedByAdminId`, status `IN_PROGRESS` — MET only via evaluate when all required modes meet).  
   - `PRODUCT_ANALYTICS` / `TRAINING_CERT` → `attestation_mode_forbidden`.

### Important

3. **`measuredMissing` OR-bug** — `valueOutcomes.js`  
   - READY when either `measuredValue` or `value` is non-null; missing both → `UNAVAILABLE` + `null` (never false zero).

4. **Audited completion waiver planAccess** — `completion.js`  
   - `hasAuditedCompletionWaiver` runs only after `loadAdoptionPlanForActor` (+ manage); cross-tenant / out-of-scope cannot claim WAIVED.

### Vitest (re-run)

```text
npx vitest run test/systemAdmin.cs.adoptionWave2.test.js test/systemAdmin.cs.adoptionWave1.test.js

 Test Files  2 passed (2)
      Tests  34 passed (34)
```

New Wave 2 coverage: client inject cannot invent MET; attest mode forbidden for product/training; value READY via `measuredValue` alone; waiver requires planAccess; PRODUCT_ANALYTICS MET via server Phase 9 firstValue read.
