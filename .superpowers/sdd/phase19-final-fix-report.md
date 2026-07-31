# Phase 19 Final Fix Report — Customer Adoption

**Date:** 2026-07-31  
**Source review:** `.superpowers/sdd/phase19-final-review.md`  
**Scope:** Critical C1–C2 + Important I1–I4  
**Commit:** none (WORKING_TREE only)

---

## Status

**FIXED** — C1, C2, I1, I2, I3, I4 applied; Wave 1–4 Vitest **56/56 PASS**.

---

## Fixed items

### C1 — Dormancy queue portfolio fail-closed
- `listDormancyRiskQueue` resolves tenant via `resolveAdoptionListScope` + planAccess.
- Client `tenantId` cannot override an in-scope plan’s tenant (`dormancy_tenant_mismatch`).
- Foreign / out-of-portfolio `tenantId` denied (`dormancy_tenant_out_of_scope`) with or without `planId`.
- Live Phase 9 signal read uses scoped tenant only.

### C2 — ADR create / Training consume portfolio before write
- `createAdoptionRequest` calls `assertAdoptionTenantInScope` before create and on idempotent/race recoveries.
- `consumeTrainingCompletionForAdoption` loads program via adoption planAccess-equivalent (Cross-Tenant + portfolio) before create.
- CS actors cannot create/consume for foreign tenants.

### I1 — validate / accept always scoped
- Both handlers resolve id then always `loadAdoptionRequestForActor` before any ADR payload / early idempotent return.

### I2 — Value-outcome honesty
- `recordAdoptionValueOutcome`: client `measuredValue` / `analyticsGate` invent READY only with `allowTestEvidenceInject`, or CS-attested path (`csAttested` + reason).
- Default path: server Phase 9 gate + snapshot; missing/unreadable → `UNAVAILABLE` + `value: null`.
- HTTP route strips invent path; forwards measured value only when CS-attested + reason.

### I3 — Dormancy RECOVERED evidence
- Client `usageReturnSnapshot` ignored unless `allowTestEvidenceInject`.
- Usage-return leg verified via server Phase 9 read; outreach path requires attestation + reason (manage + planAccess already enforced).
- HTTP no longer forwards client usage-return snapshots.

### I4 — Expansion ACK SoD default-enforced
- Creator ≠ acknowledger by default; client `enforceCreatorAckSoD: false` ignored.
- Bypass only via `allowTestSoDBypass` (test-only).
- HTTP acknowledge action does not accept client SoD disable.

---

## Tests

| Suite | Result |
|-------|--------|
| `test/systemAdmin.cs.adoptionWave1.test.js` | PASS |
| `test/systemAdmin.cs.adoptionWave2.test.js` | PASS |
| `test/systemAdmin.cs.adoptionWave3.test.js` | PASS |
| `test/systemAdmin.cs.adoptionWave4.test.js` | PASS |
| **Total** | **56/56 PASS** |

New / extended negatives cover foreign dormancy `tenantId`, cross-portfolio create/consume, validate/accept scope on early returns, client value invent → UNAVAILABLE, forged dormancy usage-return, outreach+reason RECOVERED, and expansion ACK SoD.

Command:

```bash
npx vitest run test/systemAdmin.cs.adoptionWave1.test.js test/systemAdmin.cs.adoptionWave2.test.js test/systemAdmin.cs.adoptionWave3.test.js test/systemAdmin.cs.adoptionWave4.test.js
```

---

## Key files touched

- `lib/admin/customerSuccess/adoption/listScope.js` — `assertAdoptionTenantInScope`
- `lib/admin/customerSuccess/adoption/dormancy.js` — C1 + I3
- `lib/admin/customerSuccess/adoption/requests.js` — C2 + I1
- `lib/admin/customerSuccess/adoption/trainingConsume.js` — C2
- `lib/admin/customerSuccess/adoption/valueOutcomes.js` — I2
- `lib/admin/customerSuccess/adoption/expansion.js` — I4
- `app/api/admin/customer-success/adoption-{dormancy,value-outcomes,expansion}/route.js` — HTTP strip / SoD
- Wave 1–3 Vitest extensions

Minors M1–M5 from the review were **not** in scope for this fix pass.
