# Task P12-3 Review — Wave 3 Board/UI + close + readiness

**Head:** `WORKING_TREE` (no commit, per brief)  
**Diff:** `.superpowers/sdd/task-p12-3-review-package.diff`  
**Brief / report:** `task-p12-3-brief.md` / `task-p12-3-report.md`  
**Mode:** Read-only (spec + quality)  
**Date:** 2026-07-30  
**Vitest (re-run):** `pipeline` + `opportunities` + `leads` + `opportunityWave2` + `opportunityWave3` — **54/54 passed**

---

### Spec Compliance

- ✅ **Board bounded + permission-scoped** — `getPipelineBoard` caps `columnLimit` at `BOARD_COLUMN_PAGE_SIZE=25`; AuthZ via `resolveCrmAccess` / `resolveCrmScope`; My Pipeline owner filter; `weightedUiEnabled` forced dark; meta flags `boardDragPersistForbidden` / `accessibleNonDragRequired`.
- ✅ **Accessible non-drag** — `CrmPipelineBoardView` uses labelled `<select>` (no drag handlers); POSTs `/stage`; restores prior columns on failure; surfaces `error` + `missingCriteria`.
- ✅ **Server-authorised stage change** — stage route never sets `closeServiceAuthorized`; `transition.js` denies terminal targets with `USE_CLOSE_SERVICE` + missing-criteria list (tested in Wave 3 + pipeline suites).
- ✅ **Closed Won evidence + no provision** — `closeOpportunityWon` requires evidence + `winReason` + `decisionDate`; optional approval stub; hardcodes `tenantCreated` / `subscriptionCreated` / `invoiceCreated` / `paymentCreated` / `provisionExecuted` false; `assertNoProvision()` on result. No Tenant/Subscription/Invoice writes in close path.
- ✅ **Closed Lost + reopen** — `lossReason` required; reopen requires reason → default `CUSTOMER_DECISION`; terminal status sync via transition + close field update.
- ✅ **Proposal / conversion readiness payloads only** — checklists + typed `CRM_PROPOSAL_HANDOFF` / `CRM_CONVERSION_HANDOFF` with idempotency keys; `proposalCreated` / `conversionExecuted` always false; assert helpers; conversion returns `provisionCheck`.
- ✅ **Risks / tasks / timeline** — deterministic risk codes (`isMl: false`); Opportunity-scoped tasks (`leadTaskCloned: false`); paginated timeline merge without Support/CS projection.
- ✅ **UI pages + i18n** — pipeline overview/board/list/my-pipeline + opportunities list/detail/new; en/ny board/close copy; nav live (WORKING_TREE).
- ✅ **Prisma + SQL EPERM path** — Wave 3 close columns + `CrmOpportunityRisk` + FK `DO $$` SQL; `has*Model` guards.
- ✅ **Deferred correctly** — weighted UI dark; no import/reports/EXPANSION; no ML; no Tenant provision; no Proposal create.
- ✅ **No git commit** — WORKING_TREE per brief/report.
- ⚠️ **Package incomplete** — review package includes Wave 3 libs (risks/tasks/timeline/close/readiness), SQL, Wave 3 tests, and thin page shells; omits hunks for `board.js`, UI components (`CrmPipelineBoardView`, detail/list/new), API routes, `transition.js`, `prisma/schema.prisma`, locales, nav/permissions (present on WORKING_TREE; verified there).

---

### Acceptance / verify checklist

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Closed Won evidence + no provision | ✅ | Missing evidence → `CLOSED_WON_EVIDENCE_REQUIRED`; won path sets stage/status + `assertNoProvision` ok; close route echoes provision flags false |
| Proposal/conversion payloads only | ✅ | Handoff types + null ids; `assertNoProposalCreate` / `assertNoConversionExecute`; no Proposal/Tenant create APIs |
| Board server transition | ✅ | Board POSTs `/stage` (no client persist); terminal denied without close service |
| Accessible non-drag | ✅ | Stage `<select>` + aria-label/sr-only; restore + missingCriteria on failure |
| Vitest PASS (+ prior opp suites) | ✅ | Re-run **54/54** |

**Global constraints:** Opportunity close ≠ provision; readiness ≠ execute; board transitions server-governed; weighted UI off; no ML / auto outbound / EXPANSION — met for Wave 3.

---

### Strengths

- Clean Wave 3 module split (`board` / `close` / `risks` / `tasks` / `timeline` / readiness) with honesty flags consistent from lib → API → tests.
- Terminal close correctly gated: board/stage cannot skip evidence/loss reason; close service is the only authorised path.
- Board UX matches the brief (bounded columns, accessible selector, restore + missing criteria) without enabling drag persist or weighted amounts.
- Tests map directly to the verify items (deny terminal via stage, won evidence, lost reason, reopen, readiness no-create, risks/tasks).

---

### Issues

#### Critical (Must Fix)

_None._

#### Important (Should Fix)

_None for acceptance / the four verify items._

#### Minor (Nice to Have)

1. **Close transition + evidence write not transactional** — `closeOpportunityWon` / `Lost` call `transitionOpportunityStage` then a separate `crmOpportunity.update` for close fields; if the second write fails (e.g. pre-SQL columns), stage can be terminal without persisted evidence. Prefer `$transaction` (same class as Wave 1/2 history notes; report already flags).

2. **Review package scope** — missing `board.js`, board/detail components, API routes, `transition.js`, prisma, locales/nav. Isolate full Wave 3 deltas before commit.

3. **Board select still lists terminal stages** — server denies with `USE_CLOSE_SERVICE` + missingCriteria (correct); excluding terminals or deep-linking to detail close would reduce dead-end attempts.

4. **Evidence validation is shallow** — `{}` or `['']` can satisfy `hasEvidence`; prefer non-empty typed reference values.

5. **`CRM_WIN_REASON` / `CRM_LOSS_REASON` enums unused** — any non-empty string accepted after uppercasing; optional whitelist if catalogue is meant to be closed.

6. **Reopen bypasses transition CAS** — direct update + optional history; no `expectedVersion` / sequential rules (intentional policy, but concurrent reopen can race).

7. **No HTTP-level route tests** — lib coverage is solid; board/close/readiness/risks/tasks/timeline routes untested at HTTP layer.

8. **Encoding artifacts in the review package** (`ΓÇö` / `Γëá`) — packaging mojibake; UTF-8 on disk for sources is fine.

---

### Assessment

Wave 3 delivers the brief surface with the right boundaries: bounded accessible board with server stage POSTs and restore-on-failure, Closed Won evidence + Closed Lost reason with `assertNoProvision`, and proposal/conversion readiness that emit typed handoff payloads only. WORKING_TREE wiring (transition `USE_CLOSE_SERVICE`, APIs, UI, SQL/prisma, i18n) matches the report even where the review package omits hunks. Vitest re-run is green (54/54). Residual items are hygiene / hardening — none block acceptance.

**Task quality:** Approved
