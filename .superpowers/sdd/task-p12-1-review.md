# Task P12-1 Review — Wave 1 Pipeline + Opportunity + transitions (re-review after fix pass)

**Head:** `WORKING_TREE` (no commit, per brief)  
**Diff:** `.superpowers/sdd/task-p12-1-review-package.diff`  
**Brief / report:** `task-p12-1-brief.md` / `task-p12-1-report.md`  
**Mode:** Read-only (spec + quality)  
**Date:** 2026-07-30  
**Prior review:** Important findings #1–#3; fix pass documented in report § Fix pass  
**Vitest (re-run):** `test/systemAdmin.crm.pipeline.test.js` + `test/systemAdmin.crm.opportunities.test.js` — **22/22 passed**

---

### Spec Compliance

- ✅ **NEW_BUSINESS Pipeline v1** — catalogue definition ACTIVE; 10 stable ordered stage codes; terminals `CLOSED_WON` / `CLOSED_LOST`; entry/exit + `defaultProbability` stubs; `weightedUiEnabled: false`.
- ✅ **Sequential + terminal transitions** — `canTransitionStage` allows next open stage or jump to either terminal; skip / same / post-terminal → `INVALID_TRANSITION` (tested).
- ✅ **OPP numbering** — `OPP-YYYY-######` via `CrmNumberSeq` CAS + `CRM_NUMBER_PREFIX.OPP`; format regex tested.
- ✅ **READY handoff create** — requires `type: CRM_OPPORTUNITY_HANDOFF` + `readinessStatus: READY` + `idempotencyKey`; initial stage `OPPORTUNITY_IDENTIFIED`; copies lead/account/contact; no amount/probability/closeDate invent; P2002 replay on handoff key.
- ✅ **Handoff idempotency** — same `handoffPayload.idempotencyKey` → existing row, `idempotent: true` (tested).
- ✅ **Server transition service** — `transitionOpportunityStage` + `POST .../opportunities/[id]/stage`; AuthZ `pipeline.transitionStages` / `opportunities.edit`; scope stub `all` documented; optimistic `version` lock; history append; client persist forbidden flag.
- ✅ **Lead convert gate (HTTP path)** — status route does **not** pass `fromOpportunityCreate`; `canTransition` / `transitionLeadStatus` without flag → blocked (`NOT_IMPLEMENTED`); create path converts after Opp (tested).
- ✅ **No Tenant / Subscription / Invoice / Revenue invent** — create flags + tests; serialize omits commercial fields; foundations honesty.
- ✅ **History append-only in app** — only `create` on `CrmOpportunityStageHistory`; no update/delete APIs in Wave 1 surface.
- ✅ **Permissions / nav** — live pipeline + opportunities keys; `NAV_PERMISSION_MAP` + `crmNav.js` stubs for `/pipeline` and `/opportunities`.
- ✅ **Prisma + SQL EPERM path** — models + `scripts/sql/crm-pipeline-phase12-wave1.sql` with FK `DO $$` + seed; `hasCrm*Model` guards.
- ✅ **Deferred correctly** — no Kanban/products/win-loss evidence UI/EXPANSION/weighted UI/Tenant provision.
- ✅ **No git commit** — WORKING_TREE per brief/report.
- ⚠️ **Package incomplete vs report** — review package omits hunks for several CRM core files (present on WORKING_TREE). `permissions.js` / `prisma/schema.prisma` / readiness route show Phase 5–11 surface pollution vs package base.

---

### Important fixes verification (fix pass)

| # | Finding | Fix pass claim | Working-tree verification |
|---|---------|----------------|---------------------------|
| 1 | Lead convert helper bypassable / publicly exported | `opportunityId` required; Opp loaded; `leadId` match enforced; removed from public exports; AuthZ elevated on create path | **Verified.** `lib/admin/crm/opportunities/leads.js` returns `OPPORTUNITY_REQUIRED` without `opportunityId`, `opportunity_not_found` when missing, `OPPORTUNITY_LEAD_MISMATCH` on mismatch; uses direct Lead update + history (not public `transitionLeadStatus`). Not exported from `lib/admin/crm/index.js` or `opportunities/index.js`. AuthZ: `canTransitionStatus \|\| canCreateOpportunities`. Tests: missing/mismatch Opp blocked; Lead status unchanged. |
| 2 | Create succeeds while Lead stays unconverted | Fail-closed + compensate (delete history + Opp) on convert failure | **Verified.** `create.js` wraps convert in try/catch; on `!convert.ok` calls `compensateFailedLeadConversion`, returns `ok: false`, `code: LEAD_CONVERSION_FAILED`, `compensated: true`. Test: simulated convert gate failure → Opp/history stores empty, Lead still `OPPORTUNITY_READY`. |
| 3 | Transition idempotency key-only (wrong stage accepted) | Require `prior.toStageCode === toStageCode`; else `IDEMPOTENCY_KEY_CONFLICT` | **Verified.** `transition.js` lines 122–136 compare `priorTo !== to` → conflict; exact replay returns prior stage. Test: same key + different `toStageCode` → conflict; Opp stage unchanged. |

---

### Acceptance / verify checklist

| Criterion | Status |
|-----------|--------|
| Versioned NEW_BUSINESS Pipeline + stages + entry/exit basics | ✅ |
| Unique OPP numbering; READY handoff create idempotent | ✅ |
| Server transition; invalid denied; history appended | ✅ |
| Lead `CONVERTED_TO_OPPORTUNITY` only after Opp create | ✅ |
| No Revenue / Tenant / Subscription / Invoice create | ✅ |
| Stage history immutable (app surface) | ✅ |
| Vitest PASS (pipeline + opportunities) | ✅ 22/22 re-run |

**Global constraints:** Opportunity ≠ Revenue; no invented amounts; weighted UI off; CoA untouched; server-governed transitions; no Tenant/Subscription/Invoice — met for Wave 1. Closed-Won evidence deferred to Wave 3 (brief Do NOT).

---

### Strengths

- Clean Support/CRM-shaped split: `pipeline/*` + `opportunities/*`, catalogue fallback when DB empty/EPERM.
- Transition matrix matches brief (sequential open + terminal jump); history + version lock present.
- Create path honest about non-billing (`subscriptionCreated` / `invoiceCreated` / `tenantCreated` / `amountInvented` false).
- Fix pass closes the three Important gaps with targeted tests (fail-closed create, Opp-gated convert, idempotency conflict).
- Tests map closely to acceptance (pipeline stages, invalid transitions, transition idempotency, READY create, Lead gate, no billing).

---

### Issues

#### Critical (Must Fix)

_None._

#### Important (Should Fix)

_None — prior Important #1–#3 verified fixed on WORKING_TREE._

#### Minor (Nice to Have)

1. **`transitionLeadStatus` still accepts `fromOpportunityCreate`** — optional hardening from prior review not implemented. HTTP routes do not pass the flag; only library callers with `canTransitionStatus` could spoof. Low risk vs the removed exported helper; tighten in a follow-up if desired.

2. **Stage update + history not one transaction** — `transition.js` updates Opp then appends history; history failure (or unique race) can leave stage advanced without a history row. Prefer `$transaction`; on history `P2002` for the same key, return idempotent replay.

3. **`pipelineVersionId` on Opportunity stores catalogue version string, not DB version PK** — create writes `CRM_PIPELINE_DEFINITION_VERSION` while list/get pipeline stages resolve DB rows by `CrmPipelineVersion.id`. Naming will confuse Wave 2+; store DB version id when present, or rename to `pipelineVersionKey`.

4. **Create trusts client-supplied `readinessStatus: READY`** — does not re-run `evaluateOpportunityReadiness`. Lead must be QUALIFIED / OPPORTUNITY_READY, so fully unqualified leads are blocked; a fabricated READY payload can still skip checklist honesty for QUALIFIED. Optional: server re-evaluate before create.

5. **Review package / working-tree scope pollution** — permissions/prisma/readiness appear as broad additions vs package base; several report-listed CRM core files missing from the package. Isolate Wave 1 hunks before commit.

6. **No HTTP-level route tests** — lib coverage is solid; route wiring untested.

7. **Encoding artifacts in the review package** (`ΓÇö` / `Γëá`) — packaging mojibake; UTF-8 on disk for sources is fine.

---

### Assessment

Re-review confirms the fix pass addressed all three Important findings. Lead convert is Opp-gated and module-private; create fails closed with compensation when conversion fails; transition idempotency rejects key reuse with a different target stage. Wave 1 acceptance criteria and global constraints remain met. Vitest for the two Wave 1 suites passes 22/22 on re-run. Residual items are minor hygiene or optional hardening — none block Wave 1 acceptance.

**Task quality:** Approved
