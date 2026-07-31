# Phase 12 Final Review — Sales Pipeline & Opportunity Management

**Head:** `WORKING_TREE` (dirty with Phases 7–12; no SHA range)  
**Scope:** Phase 12 CRM pipeline / opportunity surfaces (+ merge / foundations / catalogue touchpoints)  
**Spec / plan:** `docs/superpowers/specs/2026-07-30-sales-pipeline-phase-12-design.md` · `docs/superpowers/plans/2026-07-30-sales-pipeline-phase-12.md`  
**Claimed exit:** `READY_FOR_PHASE_13_WITH_BLOCKERS` (`docs/admin-intelligence-crm/phase-12/FINAL_PHASE_12_REPORT.md`)  
**Prior task reviews:** P12-T1…T4 all **Approved** (T4 after import gate re-review)  
**Mode:** Read-only (this file is the only write)  
**Date:** 2026-07-30  

---

## Verification re-run

```bash
npx vitest run \
  test/systemAdmin.crm.opportunityWave4.test.js \
  test/systemAdmin.crm.opportunityWave3.test.js \
  test/systemAdmin.crm.opportunityWave2.test.js \
  test/systemAdmin.crm.opportunities.test.js \
  test/systemAdmin.crm.pipeline.test.js
```

**Result (this review):** Test Files **5** passed (5) · Tests **57** passed (57) · failed **0**

> Note: `FINAL_PHASE_12_REPORT.md` claims **6** files / **66** tests. Working tree has five Phase 12 opportunity/pipeline suites totaling **57** (see P3 below). Suites themselves are green.

---

## Hard rules matrix

| # | Rule | Status | Evidence |
|---|------|--------|----------|
| 1 | Opportunity ≠ Lead ≠ Customer ≠ Subscription ≠ Proposal ≠ Invoice | ✅ Pass | Separate `CrmOpportunity` model; create/import/close/readiness hardcode no Tenant/Subscription/Invoice IDs; products force non-binding / no entitlement lines |
| 2 | Opportunity value ≠ Phase 6 Revenue / MRR / ARR | ✅ Pass | Commercial honesty (`isRevenue: false`, `postsRevenue: false`); reports `phase6RevenueForbidden` / `isRevenue: false`; no MRR/ARR invent in opportunity libs |
| 3 | Stage transitions server-governed; no client persist | ✅ Pass | `transitionOpportunityStage` + stage route (no `closeServiceAuthorized`); board POSTs `/stage`, restores on failure; terminals → `USE_CLOSE_SERVICE` |
| 4 | Closed Won evidence; no provision | ✅ Pass (shallow evidence noted) | `closeOpportunityWon` requires winReason + decisionDate + evidence; provision flags false + `assertNoProvision`; UI filters empty evidence lines |
| 5 | Weighted UI/reports OFF until Phase 16 | ✅ Pass | `WEIGHTED_PIPELINE_UI_ENABLED = false`; board/reports/foundations/import echo dark; helper may compute but totals `NOT_AVAILABLE` |
| 6 | Import honesty; currency-separated reports; no false zeroes | ✅ Pass | Import `successRate: null`; terminal + EXPANSION account gates; reports EMPTY/UNAVAILABLE envelopes; `summarizeAmountsByCurrency` no FX rollup |
| 7 | READY handoff create + audited import only | ✅ Pass | Create requires `CRM_OPPORTUNITY_HANDOFF` + `READY` + idempotency; import is preview/confirm audited path with keys |
| 8 | System CoA admin stays removed; no invent metrics | ✅ Pass | `/insightbooks/chart-of-accounts` still redirects removed; foundations Email/WhatsApp `NOT_AVAILABLE`; invent flags on import/report/pipeline foundations |

---

## Wave / surface coverage (WORKING_TREE)

| Wave | Delivered | Notes |
|------|-----------|--------|
| 0 | Docs + CONDITIONAL GO under `docs/admin-intelligence-crm/phase-12/` | Present |
| 1 | NEW_BUSINESS catalogue, transitions, OPP numbering, READY create | `pipeline/*`, `create.js`, tests green |
| 2 | Roles, products, commercial, probability, close dates; weighted dark | Wave 2 suite green |
| 3 | Board/list/My Pipeline, risks/tasks/timeline, close, readiness payloads | Board accessible `<select>`; close ≠ provision |
| 4 | EXPANSION/MRA_EIS, duplicates/SoD merge, import, reports+schedules, Phase 13 pack | Catalogue always surfaces three codes; Phase 13 checklist + inputs present |

SQL fallbacks: `scripts/sql/crm-pipeline-phase12-wave{1..4}.sql` present (EPERM path documented).

---

## Findings

### Critical / P0

_None._

### Important / P1

_None._

### Ordinary / P2

#### [P2] Closed Won evidence accepts empty objects — `lib/admin/crm/opportunities/close.js`

`hasEvidence` / `normalizeEvidence` treat a bare `{}` (or `[{}]`) as present evidence. API callers can satisfy `CLOSED_WON_EVIDENCE_REQUIRED` without a typed reference value. Detail UI filters blank lines, so happy-path UI is safer than the lib gate. Prefer requiring non-empty `type`/`value` (or non-empty string) before accepting evidence.

#### [P2] Close stage move and evidence write are not transactional — `lib/admin/crm/opportunities/close.js`

`closeOpportunityWon` / `Lost` call `transitionOpportunityStage` then a separate `crmOpportunity.update` for win/loss fields. If the second write fails (missing columns / EPERM client), stage/status can be terminal while evidence/reasons are only echoed in the response object. Prefer `$transaction` (same residual class as Wave 1–2 history notes; already carried in task reviews).

### Low / P3

#### [P3] Final report overstates Vitest counts — `docs/admin-intelligence-crm/phase-12/FINAL_PHASE_12_REPORT.md`

Claims **6** files / **66** tests; re-run shows **5** files / **57** tests for the listed Phase 12 command. Correct the report (and checklist wording) so exit evidence stays honest.

#### [P3] Import may land mid-pipeline without entry criteria — `lib/admin/crm/opportunities/import.js`

Confirm creates OPEN rows at requested non-terminal `stageCode` without `PRIMARY_CONTACT` / sequential transition checks. Acceptable for audited migration if intentional; document or optionally soft-warn in preview.

#### [P3] EXPANSION / MRA_EIS SQL seeds omit stage rows — `scripts/sql/crm-pipeline-phase12-wave4.sql`

Runtime falls back to catalogue definitions (OK under EPERM design). DB-backed stage lists for those versions stay empty until stages are seeded.

#### [P3] Residual carry items (already in FINAL report blockers)

- `resolveCrmScope` still `mode: 'all'` stub (non–My Pipeline)
- Merge execute non-transactional; duplicates UI thin / Lead-oriented page
- Duplicate detect peer scan `take: 200`
- No HTTP-level route tests for import/duplicates/reports/schedules/board/close
- Plan Task 1–4 checkboxes still unchecked in the plan file (docs hygiene)

---

## Spec / exit assessment

Phase 12 Waves 0–4 deliver the locked design: versioned Pipelines, READY handoff Opportunity create, server-governed transitions, non-binding commercial/probability/close-date provenance, board + win/loss (no provision), proposal/conversion **payloads only**, EXPANSION/MRA_EIS, SoD Opportunity merge, honest import, currency-separated reporting with weighted UI dark, and an explicit Phase 13 pack with carry blockers.

Claimed blockers match the tree (weighted → Phase 16, scope stub, conversion ≠ provision, EPERM, thin duplicates UI, deferred competitor/partner depth, Account/Contact merge / Email/WhatsApp still NOT_AVAILABLE).

P2 items are hardening gaps on an otherwise correct Closed Won path — they do **not** reopen provisioning, weighted UI, false zeroes, or READY-handoff invent rules. They should be fixed soon but do not invalidate `READY_FOR_PHASE_13_WITH_BLOCKERS`.

---

## Overall verdict

**Phase quality:** Approved

**Exit `READY_FOR_PHASE_13_WITH_BLOCKERS`:** Justified — hard rules held; Wave 0–4 surfaces present; Vitest Phase 12 suite green (57/57); known blockers are explicit and correctly deferred rather than papered over. Correct the final-report test counts (P3) when editing docs; treat shallow evidence + non-transactional close (P2) as Phase 13 hygiene or a small Phase 12 follow-up before heavy production use of Closed Won.
