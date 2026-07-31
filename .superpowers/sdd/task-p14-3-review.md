# Task P14-3 Review — Wave 3 Logical Environment + data packs + checklist/rehearsal

**Mode:** Spec + quality (read-only)  
**Head:** `WORKING_TREE` (no commit, per brief)  
**Diff:** `.superpowers/sdd/task-p14-3-review-package.diff`  
**Brief / report:** `task-p14-3-brief.md` / `task-p14-3-report.md`  
**Date:** 2026-07-30  

**Vitest (re-run):**  
`npx vitest run test/systemAdmin.crm.demoWave3.test.js test/systemAdmin.crm.demoWave2.test.js test/systemAdmin.crm.demoWave1.test.js`  
→ **3 files, 27/27 passed**

---

### Spec Compliance

| Criterion | Status | Notes |
|-----------|--------|-------|
| DENV numbers; provision/reset idempotent; expiry; DEMO banner | ✅ | `DENV-YYYY-######`; request requires future `expiresAt`; provision/reset/deprovision idempotency keys; banner forced true on request/provision/reset; READY only after APPROVED → PROVISIONING → health |
| Production data/credentials rejected | ✅ | `validateDataPackSource` rejects forbidden source kinds, production tenant flags, credential keys, payload production signals; create path tested |
| Checklist/rehearsal Critical blocks readiness | ✅ | When `requires*` configured: Critical checklist fails → `criticalFailed` + FAILED; Critical rehearsal issues coerce FAILED; readiness `checklist_gate` / `rehearsal_gate` CRITICAL blockers (tested) |
| Logical READY never invented / no cloud fabricate | ✅ | Health requires logical token + `cloudProvisionStatus === NOT_AVAILABLE`; `fabricateCloud`/`cloudProvider` → `cloud_demo_infra_not_available`; contract `cloudDemoInfra: NOT_AVAILABLE`, `inventEnvironmentReadyForbidden` |
| Never alias MRA EIS sandbox | ✅ | Request rejects `aliasMraEisSandbox` / `useProductionTenant`; health fails if aliased; contract `mraEisSandboxEqualsDemoEnvironment: false` |
| Wire readiness gates (env READY when type requires) | ✅ | Opt-in `requiresLogicalEnvironment` / `requiresChecklist` / `requiresRehearsal`; unconfigured gates INFO (Waves 1–2 green) |
| Prisma + SQL + APIs + thin UI | ✅ | Models + `crm-demo-phase14-wave3.sql`; demo-environments/data-packs/checklists/rehearsals APIs; demo actions; `CrmStubView` hubs |
| Vitest claimed PASS | ✅ | Re-run **27/27** (Wave 3 + 2 + 1) |
| No git commit / no real cloud / no recording / delivery / Proposal | ✅ | Per brief/report |

---

### Verify checklist (detailed)

1. **DENV + idempotent provision/reset** — `allocateDemoEnvironmentNumber` → `DENV-…`; same `provisionIdempotencyKey` / `resetIdempotencyKey` returns `alreadyProvisioned` / `alreadyReset`; request key race-safe via P2002.
2. **Production rejected** — Source kinds `PRODUCTION` / `PRODUCTION_TENANT` / etc.; `productionTenantId`; credential keys in payload; create refuses Production.
3. **Critical rehearsal/checklist block readiness** — Configured demo BLOCKED on missing env/checklist/rehearsal; Critical fail keeps `checklist_gate`; Critical rehearsal issue keeps `rehearsal_gate`; clear after pass.
4. **No cloud fabricate** — Lib rejects fabricate flags; provision always writes `cloudProvisionStatus: NOT_AVAILABLE`; health `cloudNotFabricated` required for READY.
5. **Vitest PASS** — **27/27** re-confirmed.

---

### Strengths

- Clear READY path: REQUESTED → SoD APPROVED → PROVISIONING → health → READY; expiry + DEMO banner + no Production/MRA alias enforced in health.
- Data-pack validation is layered (source kind allowlist, explicit flags, key/scan regex).
- Readiness Wave 3 gates are opt-in so prior demos stay green; honesty flags on domain contract (`wave: 3`).
- Tests cover DENV lifecycle, Production reject, Critical gates, unconfigured INFO, and contract.

---

### Issues

#### Critical (Must Fix)

_None._

#### Important (Should Fix)

_None._

#### Minor (Nice to Have)

1. **`PROVISIONING` not re-enterable** — If the mid-path status update commits and the final READY/UNHEALTHY update fails, retry hits `environment_not_approved_for_provision` / `environment_not_resettable`. Allow `PROVISIONING` (and wrap both updates in a transaction) for recovery. Unlikely on sync happy path; not acceptance-blocking.
2. **Review package incomplete vs report / working tree** — Package covers environments/dataPacks/checklists/rehearsals + SQL + Wave 3 test; omits Prisma, readiness/catalogue/service wiring, APIs, UI stubs. Review used working tree. Cosmetic packaging only.
3. **No Vitest for `fabricateCloud` / `cloudProvider` reject** — Implemented in lib; API does not forward those body fields (also safe). Optional explicit test.
4. **Optional CRITICAL checklist items** — `criticalFailed` requires `required && CRITICAL`; a non-required Critical fail can still yield PASSED. Normal templates use required Critical; tighten if product wants severity alone to fail.
5. **Prisma generate / UI stubs** — Documented report concerns; SQL + `hasCrm*Model` + stub hubs expected for Wave 3.

---

### Acceptance checklist (brief)

- [x] DENV numbers; provision/reset idempotent; expiry; DEMO banner
- [x] Production data/credentials rejected
- [x] Checklist/rehearsal block readiness on Critical fails (when configured)
- [x] Vitest PASS (Wave 3 + Waves 1–2) — 27/27
- [x] No real cloud fabricate; no MRA EIS alias; no git commit

---

### Assessment

Wave 3 delivers logical DENV lifecycle with idempotent provision/reset, Production-safe data packs, and opt-in checklist/rehearsal readiness gates that block on Critical failures. READY is never invented without the approved provision + health path; cloud infra stays `NOT_AVAILABLE`. Vitest re-run is 27/27. Remaining items are packaging/recovery polish.

**Task quality:** Approved
