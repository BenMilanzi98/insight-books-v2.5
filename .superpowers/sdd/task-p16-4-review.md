# Task P16-4 Review — Wave 4 Handoffs / hubs / reports / weighted UI / Phase 17 pack

**Mode:** Spec + quality (read-only)  
**Head:** `WORKING_TREE` (no commit, per brief)  
**Brief / report:** `task-p16-4-brief.md` / `task-p16-4-report.md`  
**Date:** 2026-07-31  
**Vitest:** Not re-run (per instructions); claimed Wave 4 6/6 (+ related 74); source has **6** `it(...)` matching brief TDD list  

---

### Spec Compliance: ✅

| Criterion | Status | Notes |
|-----------|--------|-------|
| CS assignment + domain handoffs | ✅ | `customerSuccess.js` + `*Handoff.js` via `handoffShared`; exported from conversions barrel / `lib/admin/crm` |
| Handoffs idempotent; ≠ full execution | ✅ | Exact `idempotencyKey` replay; `executionStatus` forced `NOT_STARTED`; return flags force incomplete |
| Completion certificate + compensate | ✅ | Stable SHA-256 checksum; compensate never calls acceptance delete/deleteMany |
| Reports / DQ / recon reliability gate | ✅ | Fail → `value`/`report`/`checks`/`cards` null; `inventZeroesForbidden`; EMPTY ≠ fail |
| Weighted UI honesty/currency gated | ✅ (lib) / ⚠ (API) | `resolveWeightedPipelineUiAccess` + capability flag; API route bypasses accessor (Important #1) |
| Exit docs + READY_FOR_PHASE_17_WITH_BLOCKERS | ✅ | `FINAL_PHASE_16_REPORT`, `PHASE_17_INPUTS`, `PHASE_17_READINESS_CHECKLIST`, `FINAL_READINESS_DECISION` |
| SQL / Prisma | ✅ | Wave 4 models + `crm-conversion-phase16-wave4.sql` |
| UI stubs | ✅ | Thin conversion overview/queues/my-work; hubs thin OK per brief |
| No commit | ✅ | WORKING_TREE |
| Vitest Wave 4 PASS (claim) | ✅ | Report 6/6; source cases match TDD |

### Global constraints spot-check

- Handoffs idempotent; ≠ full execution — **held** (return path); payload overwrite gap — Important #2  
- Gate fail ≠ false zero — **held**  
- Weighted UI honesty-gated — **held in accessor**; commercial HTTP response — **not held** (Important #1)  
- Exit READY_FOR_PHASE_17_WITH_BLOCKERS — **confirmed**  
- No commit — **held**

---

### Issues

#### Critical (Must Fix)

_None._

#### Important (Should Fix)

1. **Commercial API exposes ungated `weightedUiEnabled` after capability flip** — `app/api/admin/crm/opportunities/[id]/commercial/route.js` (~46, ~105)  
   Wave 4 sets `WEIGHTED_PIPELINE_UI_ENABLED = true`. GET/POST return `weightedUiEnabled: WEIGHTED_PIPELINE_UI_ENABLED` (always true), ignoring `getOpportunityCommercial(...).weightedUiEnabled` which correctly uses `resolveWeightedPipelineUiAccess(args.uiGate || {})`. Clients reading the HTTP flag unlock weighted UI without honesty/currency gates. Return gated unlock (and optionally `weightedUiCapability` separately).

2. **Domain handoff `payload` spread can overwrite forced execution/fiscal flags** — `mraEisHandoff.js` (~19–26), `migrationHandoff.js` (~19–25), similarly onboarding/training  
   Forced `fiscalSubmitted: false` / `credentialsStored: false` / `productionImportExecuted: false` are placed **before** `...(args.payload)`, so a caller can persist `true` in `payloadJson`. Return envelopes re-force false, but Phase 17 consumers of stored payload can be lied to. Re-force forbidden flags **after** spread (and/or strip them in `handoffShared`).

#### Minor (Nice to Have)

1. **Stale test titles** — `opportunityWave2` / `opportunityWave4` still say UI flag OFF while asserting `WEIGHTED_PIPELINE_UI_ENABLED` true (behavior OK via locked default `uiGate`).
2. **CS assign ownership mutation not tied to assignment idempotency** — ends primary ownerships then creates assignment; mid-failure retry with same key may create a second ownership before assignment row exists.
3. **`reliabilityOk` alone satisfies honesty half of weighted gate** — alias may unlock without explicit `honestyOk`.
4. **`computeIndicativeWeightedAmount` still returns `ok: true` when UI locked** — intentional helper; UI must honor `weightedUiEnabled` / accessor (API Important #1 makes this sharper).
5. **Prisma EPERM / SQL fallback** — apply `scripts/sql/crm-conversion-phase16-wave4.sql` before runtime (report concern).
6. **Conversion UI hubs thin stubs** — accepted by brief; services are truth surface.
7. **`resolveCrmScope` still `mode: 'all'` stub** — carry blocker; documented in exit pack.

---

### Acceptance checklist (brief)

- [x] Vitest Wave 4 PASS (claimed 6/6; not re-run; source matches TDD)
- [x] Handoffs idempotent
- [~] Weighted UI honesty-gated — accessor OK; commercial route bypass (Important #1)
- [x] Exit docs + readiness recorded (`READY_FOR_PHASE_17_WITH_BLOCKERS`)
- [x] No commit

### Assessment

Wave 4 modules, SQL/Prisma, honesty-gated metrics/DQ/recon, completion/compensate, exit pack, and claimed TDD coverage meet the brief. Exit state **READY_FOR_PHASE_17_WITH_BLOCKERS** is correctly recorded with payment/provider/execution blockers explicit. Quality is **not** approved until the commercial API stops advertising ungated weighted UI and handoff payloads cannot persist fabricated fiscal/execution-complete flags.

**Spec:** ✅  
**Task quality:** Not approved  
**Findings:** Critical 0 · Important 2 · Minor 7  
**Exit state confirmed:** `READY_FOR_PHASE_17_WITH_BLOCKERS`

**Review path:** `.superpowers/sdd/task-p16-4-review.md`

---

## RE-REVIEW (post Important #1–#2 fixes)

**Date:** 2026-07-31  
**Mode:** Spec + quality (read-only; no code mutation)  
**Vitest:** Not re-run; report claims 8/8; source has **8** `it(...)` (prior 6 + commercial ungated + handoff forge)

### Important #1 — FIXED ✅

`app/api/admin/crm/opportunities/[id]/commercial/route.js` GET/POST return `weightedUiEnabled: result.weightedUiEnabled === true` and `weightedUiCapability: result.weightedUiCapability === true` — never raw `WEIGHTED_PIPELINE_UI_ENABLED`. `getOpportunityCommercial` / `setOpportunityCommercial` gate unlock via `resolveWeightedPipelineUiAccess`; `isRevenue: false` retained.

### Important #2 — FIXED ✅

Onboarding/training/migration/MRA handoffs force completion/fiscal flags **after** `...(args.payload)`. `handoffShared` re-forces `executionComplete: false` / `executionStatus: NOT_STARTED` after payload spread before persist.

### Spec Compliance (re-check): ✅

| Criterion | Status | Notes |
|-----------|--------|-------|
| Weighted UI honesty/currency gated | ✅ | Lib accessor + commercial HTTP gated unlock |
| Handoffs ≠ forged execution/fiscal in stored payload | ✅ | Force-after-spread + shared re-force |
| Vitest Wave 4 (source) | ✅ | **8/8** `it(...)` at `test/systemAdmin.crm.conversionWave4.test.js` |
| Exit READY_FOR_PHASE_17_WITH_BLOCKERS | ✅ | Still in report + `FINAL_*` / readiness docs |

### Remaining issues

#### Critical / Important

_None open._

#### Minor (carry; unchanged)

Prior Minor #1–#7 still apply (stale titles, CS ownership race, `reliabilityOk` alias, indicative helper when locked, SQL apply, thin hubs, scope stub). None reopen Important #1–#2.

### Acceptance checklist (re-check)

- [x] Vitest Wave 4 PASS (claimed 8/8; source **8** `it(...)`)
- [x] Handoffs idempotent; stored payload forge-hardened
- [x] Weighted UI honesty-gated (lib + commercial route)
- [x] Exit docs + readiness recorded (`READY_FOR_PHASE_17_WITH_BLOCKERS`)
- [x] No commit

### Assessment

Important #1–#2 are verified fixed at source. Wave 4 meets brief; exit **READY_FOR_PHASE_17_WITH_BLOCKERS** remains recorded. Quality approved with prior Minors as carry notes only.

**Spec:** ✅  
**Task quality:** Approved  
**Findings:** Critical 0 · Important 0 (open) · Minor 7 (carry)  
**Exit state confirmed:** `READY_FOR_PHASE_17_WITH_BLOCKERS`  
**Vitest at source:** 8/8  

**Review path:** `.superpowers/sdd/task-p16-4-review.md`
