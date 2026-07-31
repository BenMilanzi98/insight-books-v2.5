### Task 4: Wave 4 — Extra Pipelines + duplicates/merge + import + reports + Phase 13 pack

**Depends on:** Waves 1–3 CrmOpportunity / NEW_BUSINESS Pipeline / board / close / readiness (WORKING_TREE).

**Files (create / extend):**
- `lib/admin/crm/pipeline/catalogue.js` + `definitions.js` — ACTIVE catalogue definitions for **EXPANSION** and **MRA_EIS** (versioned; same stage-governance pattern as NEW_BUSINESS; distinct pipeline codes/versions). Prefer shared stage codes where fit; document any pipeline-specific entry criteria.
- `lib/admin/crm/opportunities/duplicates.js` — duplicate Opportunity candidates (same Account / overlapping commercial / same handoff key patterns — never invent). Surface status; no auto-merge.
- Extend `lib/admin/crm/merge.js` (or `opportunities/merge.js`) — Opportunity merge SoD: request → approve → execute; **requester ≠ approver**; evidence JSON (survivor/loser + history refs); no silent merge. Reuse Lead merge patterns; entity type OPPORTUNITY.
- `lib/admin/crm/opportunities/import.js` — full Opportunity bulk import: preview + confirm; **idempotent keys**; honesty gates (no fake success %); currency/basis required for amounts; map pipelineCode (NEW_BUSINESS | EXPANSION | MRA_EIS); fail closed on invalid stage/currency.
- `lib/admin/crm/opportunities/reports.js` + schedule module — Pipeline reporting centre: stage counts, open pipeline by currency (**currency-separated**; no silent FX rollup); win/loss counts; **never false zeroes** (empty → UNAVAILABLE / empty envelope). Scheduled Pipeline reports (create/list/run stub or real schedule table) with audit.
- Weighted: ensure `computeIndicativeWeightedAmount` / flag remains **`WEIGHTED_PIPELINE_UI_ENABLED = false`**; reports must **not** expose weighted totals as enabled UI.
- Upgrade `lib/admin/crm/foundations.js` — IMPORT / REPORTING / OPPORTUNITY_PIPELINE reflect Wave 4 delivered where honest (READY or FOUNDATION→READY for Opportunity import/reporting planes); Email/WhatsApp stay NOT_AVAILABLE; weighted stays dark.
- Prisma models + SQL `scripts/sql/crm-pipeline-phase12-wave4.sql` (EPERM-safe: guards + SQL fallback).
- APIs under `app/api/admin/crm/` for pipelines list (all three), opportunity duplicates, opportunity merge, import preview/confirm, reports, report schedules.
- Thin UI surfaces under `/insightbooks/crm/` for imports + reports/schedules (match existing AdminShell / en+ny patterns; no inventing KPIs).
- Docs pack:
  - `docs/admin-intelligence-crm/phase-12/FINAL_PHASE_12_REPORT.md`
  - `docs/admin-intelligence-crm/phase-12/PHASE_13_INPUTS.md`
  - `docs/admin-intelligence-crm/phase-12/PHASE_13_READINESS_CHECKLIST.md`
- Tests: `test/systemAdmin.crm.opportunityWave4.test.js` (+ keep Waves 1–3 green)

**Do NOT:** enable weighted Pipeline UI/reports; provision Tenant/Subscription/Invoice on Closed Won; invent funnel % or import success rates; treat analytics-pipeline as CRM; create Opportunities outside READY handoff **or** audited import path; git commit.

## Rules

- Opportunity ≠ Lead ≠ Customer ≠ Subscription ≠ Proposal ≠ Invoice
- Opportunity value ≠ Phase 6 Revenue / MRR / ARR
- Currency explicit; multi-currency report totals separated or UNAVAILABLE
- Stage transitions still server-governed for imported + merged records
- Closed Won evidence rules unchanged (no provision)
- Exit decision: **READY_FOR_PHASE_13_WITH_BLOCKERS** (document carry blockers: weighted UI Phase 16; owner/team/territory scope stub; optional competitor/partner if still deferred)

## Global Constraints

Phase 12 plan + design. **Do not git commit.** WORKING_TREE only. If `prisma generate` EPERM → ship SQL + runtime model guards.

## Acceptance

- [ ] EXPANSION + MRA_EIS Pipelines ACTIVE in catalogue (and seedable via SQL)
- [ ] Opportunity duplicate candidates + SoD merge (no silent merge)
- [ ] Import idempotent; honesty gates; currency/basis required
- [ ] Reports currency-separated; no false zeroes; schedules audited
- [ ] Weighted service OK; UI/report flag OFF
- [ ] FINAL_PHASE_12_REPORT + PHASE_13_INPUTS + PHASE_13_READINESS_CHECKLIST
- [ ] Exit READY_FOR_PHASE_13_WITH_BLOCKERS
- [ ] Vitest PASS (Wave 4 + prior opportunity suites)
