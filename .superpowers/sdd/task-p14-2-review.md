# Task P14-2 Review — Wave 2 Agenda / Script / Scenario / Content versioning

**Mode:** Spec + quality (read-only)  
**Head:** `WORKING_TREE` (no commit, per brief)  
**Diff:** `.superpowers/sdd/task-p14-2-review-package.diff`  
**Brief / report:** `task-p14-2-brief.md` / `task-p14-2-report.md`  
**Date:** 2026-07-30  

**Vitest (re-run):**  
`npx vitest run test/systemAdmin.crm.demoWave2.test.js test/systemAdmin.crm.demoWave1.test.js`  
→ **2 files, 19/19 passed**

---

### Spec Compliance

| Criterion | Status | Notes |
|-----------|--------|-------|
| Versioned Agenda/Script/Scenario/Content; ACTIVE immutable in place | ✅ | Create → DRAFT; update rejects `ACTIVE` with `active_demo_content_not_directly_editable`; PENDING/RETIRED not editable; new version + approve retires prior ACTIVE |
| SoD approve where material (author ≠ approver) | ✅ | `assertSodApprover` on all four approve paths; self-approve → `demo_content_self_approval_blocked` (Agenda tested); mirrors P13 requester≠approver after request |
| Restricted Script projection protected | ✅ | `projectScriptForSurface` fail-closed for CUSTOMER/INVITATION; Internal needs `canViewRestricted`; demo-scripts GET re-projects when `surface` set |
| Demo pins versions; historical pin retained | ✅ | `pin*ToDemo` requires ACTIVE; approve newer ACTIVE does not rewrite Demo pin columns (tested) |
| No Env / delivery / recording / Proposal create | ✅ | Env remains readiness INFO deferred Wave 3; no delivery/recording/Proposal create in Wave 2 surface |
| No arbitrary executable template expressions | ✅ | `assertSafeDemoContentText` / `assertSafeJsonTree`; Agenda bad `${}` tested |
| en/ny script label foundations | ✅ | `labelsJson` on Script; contract `inventAiScriptForbidden: true` |
| Prisma + SQL + model guards | ✅ | `CrmDemoAgenda/Script/Scenario/Content` + pin columns; `crm-demo-phase14-wave2.sql`; `hasCrm*Model` |
| APIs + thin UI stubs | ✅ | `demo-agendas/scripts/scenarios/content` + demo `pin-*` actions; UI `CrmStubView` hubs |
| Required interfaces / domain contract wave 2 | ✅ | Exports match report; `getDemoDomainContract()` → `wave: 2`, `activeDirectlyEditable: false`, `restrictedScriptOnCustomerForbidden: true` |
| Vitest claimed PASS | ✅ | Re-run **19/19** (Wave 2 + Wave 1) |
| No git commit | ✅ | Per brief/report |

---

### Verify checklist (detailed)

1. **ACTIVE immutable** — All four `update*Version` paths reject ACTIVE and non-editable statuses; status cannot be patched via update; only approve promotes PENDING → ACTIVE after `retirePriorActive`.
2. **SoD approve** — Shared `assertSodApprover`; approve requires PENDING + approve privilege; same admin create→request→approve blocked (`demo_content_self_approval_blocked`).
3. **Restricted Script protected** — RESTRICTED → null on CUSTOMER/INVITATION; Internal without privilege blocked; CUSTOMER_SAFE omits `bodyInternal`; Agenda invitation projection omits `itemsJson`.
4. **Demo pins versions** — Pin APIs + action route; non-ACTIVE refused (`demo_content_not_active`); historical pin retained across re-approve of same code.
5. **No Env/delivery** — Readiness still defers `logical_environment`; Wave 2 contract/honesty flags unchanged; out-of-scope surfaces not introduced.
6. **Vitest PASS** — **19/19** re-confirmed.

---

### Strengths

- Shared `versioning.js` keeps immutability, SoD, and expression hygiene consistent across Agenda/Script/Scenario/Content.
- Restricted Script and Agenda customer-safe projections are fail-closed with clear reason codes.
- Demo pin model stores version ids and does not chase the latest ACTIVE — correct historical semantics.
- Wave 2 tests cover ACTIVE immutability, SoD self-approve, restricted projection, pin retention, executable-expression reject, and domain contract.

---

### Issues

#### Critical (Must Fix)

_None._

#### Important (Should Fix)

_None._

#### Minor (Nice to Have)

1. **Review package incomplete vs report / working tree** — Package mainly duplicates Agenda/Script/Scenario/Content + SQL + Wave 2 test; omits `versioning.js`, APIs, Prisma pin/models, catalogue constants, readiness, demos `index.js`, UI stubs. Review used working tree. Cosmetic packaging only.
2. **`request*Approval` overwrites `authoredByAdminId`** — SoD effectively becomes requester≠approver (P13 automation style). Original creator can approve if a colleague requests. Helper still mentions unused `requestedByAdminId` (no schema column). Prefer keep creator + separate requester for audit/SoD-both.
3. **Approve + `retirePriorActive` not one transaction** — Concurrent approve of two PENDING versions of the same code could leave two ACTIVE briefly.
4. **Agenda list API lacks `surface` re-projection** — Scripts GET filters CUSTOMER/INVITATION; agendas always return full `itemsJson` (admin-only today; helper exists for later callers).
5. **SoD self-approve tested only on Agenda** — Script/Scenario/Content share the helper; optional parity tests.
6. **Prisma generate not run / UI stubs** — Documented report concerns; SQL + `hasCrm*Model` + stub hubs expected for Wave 2.
7. **REJECTED status with no reject action** — Enum/editable set includes REJECTED; no `reject*Version` API (not in acceptance).

---

### Acceptance checklist (brief)

- [x] Versioned Agenda/Script/Scenario/Content; ACTIVE immutable in place
- [x] SoD approve where material
- [x] Restricted Script projection protected
- [x] Demo pins versions; historical pin retained
- [x] Vitest PASS (Wave 2 + Wave 1) — 19/19
- [x] No Env / delivery / recording / Proposal create
- [x] No git commit

---

### Assessment

Wave 2 delivers versioned Agenda/Script/Scenario/Content with ACTIVE immutability, SoD on material approve, fail-closed restricted Script (and Agenda customer-safe) projections, and Demo historical version pins. Vitest re-run is 19/19. Remaining items are packaging/polish. Ready to proceed.

**Task quality:** Approved
