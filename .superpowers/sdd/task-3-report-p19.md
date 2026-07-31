# Task 3 Report — Phase 19 Wave 3 (Champions / dormancy / Phase 8 interventions / expansion)

**Date:** 2026-07-31  
**Status:** COMPLETE (GREEN)  
**Commit:** none (WORKING_TREE only, per brief)

---

## Summary

Implemented Phase 19 Wave 3 under `lib/admin/customerSuccess/adoption/**`: contact-verified champions (no engagement scores), dormancy risk queue from Phase 9 inactive-class signals (UNAVAILABLE when analytics missing), dormancy recovery cases with RECOVERED evidence gate, Phase 8 intervention link-by-id only, idempotent record-only expansion handoffs (`DRAFT`→`HANDED_OFF`→`ACKNOWLEDGED`), SQL + Prisma models, thin APIs/UI, Vitest Waves 1–3 green.

---

## RED

```text
npx vitest run test/systemAdmin.cs.adoptionWave3.test.js

 FAIL  test/systemAdmin.cs.adoptionWave3.test.js
 TypeError: upsertAdoptionChampion / openDormancyRecoveryCase / createExpansionHandoff is not a function
 …
 Test Files  1 failed (1)
      Tests  8 failed (8)
```

Failure mode: missing Wave 3 domain exports (expected before implementation).

---

## GREEN

```text
npx vitest run test/systemAdmin.cs.adoptionWave1.test.js test/systemAdmin.cs.adoptionWave2.test.js test/systemAdmin.cs.adoptionWave3.test.js

 Test Files  3 passed (3)
      Tests  42 passed (42)
 Duration  ~2.3s
```

| Case | Result |
|------|--------|
| Champion requires verified contact; engagement score rejected | PASS |
| Dormancy queue analytics missing → UNAVAILABLE (≠ healthy zero) | PASS |
| RECOVERED without usage-return / outreach fails | PASS |
| Intervention link requires real Phase 8 intervention id | PASS |
| Expansion handoff idempotent; ACK without billing writes | PASS |
| Cross-tenant writes denied via loadAdoptionPlanForActor | PASS |
| HANDED_TO_RENEWALS after HANDED_OFF expansion handoff | PASS |
| Domain contract wave ≥ 3 + Wave 3 forbidden flags | PASS |
| Wave 1+2 regression (34 tests) | PASS |

---

## Deliverables

| Area | Path |
|------|------|
| Domain | `lib/admin/customerSuccess/adoption/{champions,dormancy,interventions,expansion}.js` (+ catalogue/model/status/index) |
| SQL | `scripts/sql/cs-adoption-phase19-wave3.sql` |
| Prisma | `CustomerAdoption{Champion,DormancyCase,InterventionLink,ExpansionHandoff}` |
| API | `app/api/admin/customer-success/adoption-{champions,dormancy,expansion}/route.js` |
| UI | `app/insightbooks/customer-success/adoption/{champions,dormancy,expansion}/page.js` (+ hub links) |
| Test | `test/systemAdmin.cs.adoptionWave3.test.js` |

### Interfaces shipped

- `upsertAdoptionChampion` — verified CRM contact; rejects engagementScore / fabricated scores
- `listDormancyRiskQueue` — Phase 9 `VALUE_THEN_INACTIVE` / inactive-class; analytics missing → `UNAVAILABLE`, `totalRiskCount: null`, `healthyEmpty: false`
- `openDormancyRecoveryCase` / `linkPhase8Intervention` / `attestDormancyOutcome`
- `RECOVERED` blocked without usage-return snapshot and/or attested outreach (`RECOVERED_EVIDENCE_REQUIRED`)
- `createExpansionHandoff` / `acknowledgeExpansionHandoff` — `DRAFT`→`HANDED_OFF`→`ACKNOWLEDGED`; meta flags all billing mutations false
- Exact retry same expansion `idempotencyKey` → same handoff
- All writes gate via `loadAdoptionPlanForActor`
- Intervention link requires existing Phase 8 `CsIntervention` id (no engine rebuild)
- `HANDED_TO_RENEWALS` unlocked when plan has expansion handoff `HANDED_OFF`|`ACKNOWLEDGED` (or audited waiver)

### Phase 8 / 9 reuse

- Phase 8: `lib/admin/customerSuccess/interventions.js` / `playbooks.js` — **link only** (store `interventionId` / optional playbook execution id)
- Phase 9: `lib/admin/productAnalytics/signals.js` — read-only dormancy queue source

---

## Out of scope (correctly deferred)

- Hub polish, metrics/DQ/recon/lineage, Phase 8 foundations projection (Wave 4)
- Renewals/billing execute after ACK (Phase 20)
- Tenant GL mutations

---

## Concerns

1. **Prisma generate / db push** may hit Windows EPERM — use `scripts/sql/cs-adoption-phase19-wave3.sql` + `hasModel` guards (fail closed to UNAVAILABLE).
2. **SoD creator≠acknowledger** is opt-in via `enforceCreatorAckSoD: true` (default soft).
3. SDD review gate before Wave 4.

---

## Fix wave

**Date:** 2026-07-31  
**Trigger:** Important findings from `task-3-review-p19.md` (live dormancy analytics honesty + expansion P2002 race).  
**Commit:** none (WORKING_TREE only)

### Fixes

1. **Dormancy queue — Phase 9 fact plane missing ≠ healthy zero** (`lib/admin/customerSuccess/adoption/dormancy.js`)  
   Live path (no inject) probes `analyticsFactProductUsage.findMany` + `productFirstValueFact.findUnique` before `evaluateProductSignalsForTenant`. Missing/unreadable → `status: UNAVAILABLE`, `totalRiskCount: null`, `healthyEmpty: false`, `reasonCode: phase9_fact_plane_unavailable`. Never treats empty signals from absent models as READY/healthyEmpty.

2. **Expansion create — P2002 exact-key race recovery** (`lib/admin/customerSuccess/adoption/expansion.js`)  
   Create wrapped in try/catch; on Prisma `P2002` with matching `idempotencyKey`, re-fetch existing handoff and return `idempotentReplay` / `alreadyExists` (Wave 1 plans/requests pattern).

### Tests extended

- Live dormancy GET-shaped call (no `analyticsAvailable` / signal inject) with missing fact delegates → UNAVAILABLE  
- Concurrent expansion create: pre-check miss + P2002 unique → same handoff replay  

### Verification

```text
npx vitest run test/systemAdmin.cs.adoptionWave1.test.js test/systemAdmin.cs.adoptionWave2.test.js test/systemAdmin.cs.adoptionWave3.test.js

 Test Files  3 passed (3)
      Tests  42 passed (42)
 Duration  ~1.3s
```

| Case | Result |
|------|--------|
| Explicit analyticsAvailable:false → UNAVAILABLE | PASS |
| Live path missing Phase 9 fact plane → UNAVAILABLE (not healthyEmpty) | PASS |
| Expansion sequential idempotent replay | PASS |
| Expansion P2002 race → same handoff idempotentReplay | PASS |
| Waves 1+2 regression | PASS |
