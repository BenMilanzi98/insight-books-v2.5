# Sales Pipeline & Opportunity Management Phase 12 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Checkbox steps for tracking.

**Goal:** Ship `/insightbooks/crm/pipeline` + `/insightbooks/crm/opportunities` with versioned Pipelines, governed stage transitions, CrmOpportunity from Phase 11 READY handoffs, non-binding commercial estimates, explainable probability, win/loss, and import/reporting — without provisioning or Phase 6 Revenue mixing.

**Architecture:** Wave 0 matrices → extend `lib/admin/crm/*` + CrmPipeline*/CrmOpportunity* Prisma → APIs → UI. Weighted Pipeline service dark until Phase 16.

**Tech Stack:** Next.js, Prisma, Vitest, AdminShell, metric envelopes, en/ny, owner/team/territory scope.

**Spec:** [docs/superpowers/specs/2026-07-30-sales-pipeline-phase-12-design.md](../specs/2026-07-30-sales-pipeline-phase-12-design.md)

## Global Constraints

- Opportunity ≠ Lead ≠ Customer ≠ Subscription ≠ Proposal ≠ Invoice.
- Opportunity value ≠ Phase 6 Revenue / MRR / ARR.
- Stage transitions server-governed; history immutable.
- Probability explainable/versioned/confidence — not ML; not certainty.
- Currency explicit; no silent FX.
- Closed Won evidence required; no Tenant/Subscription/Invoice create.
- READY handoff only; capture/create idempotent.
- Weighted Pipeline UI disabled until Phase 16.
- No fabricated records; no false zeroes; CoA admin stays removed.
- Commits only when user asks.

---

### Task 0: Wave 0 — Forensic audits + matrices

**Files:** `docs/admin-intelligence-crm/phase-12/*`

- [x] Validate Phase 11 READY_FOR_PHASE_12_WITH_BLOCKERS
- [x] CURRENT_* audits + matrices + gap register + IMPLEMENTATION_PLAN
- [x] CONDITIONAL GO for Wave 1
- [x] Stop before Wave 1 code unless user says continue

---

### Task 1: Wave 1 — Pipeline + Opportunity + handoff create + transitions

**Files:** pipeline/*, opportunities/*, transition service; Prisma; SQL; APIs; Lead CONVERTED_TO_OPPORTUNITY; tests

- [ ] Versioned NEW_BUSINESS Pipeline + stages + entry/exit
- [ ] Unique OPP-YYYY-######; create from READY handoff idempotent
- [ ] Server transition service; invalid/drag denied without criteria
- [ ] Vitest PASS

---

### Task 2: Wave 2 — Roles + products + commercial + probability + close dates

**Files:** contact roles, products, commercial, probability, closeDate modules + APIs + tests

- [ ] Non-binding products; amount basis + currency; amount history
- [ ] Stage default probability + override + confidence; not ML
- [ ] Close date source + confidence + history
- [ ] Vitest PASS

---

### Task 3: Wave 3 — Board/UI + risks/tasks/timeline + win/loss + readiness handoffs

**Files:** board, list, my-pipeline UI; risks; tasks; timeline; close; proposal/conversion readiness; tests

- [ ] Board bounded columns; accessible non-drag transition
- [ ] Closed Won evidence; no provision
- [ ] Proposal/conversion readiness payloads only
- [ ] Vitest PASS

---

### Task 4: Wave 4 — Extra Pipelines + merge + import + reports + Phase 13 pack

**Files:** EXPANSION/MRA_EIS pipelines; duplicates/merge; import; reports/schedules; FINAL_PHASE_12_REPORT, PHASE_13_INPUTS

- [ ] Import idempotent; reports currency-separated; no false zeroes
- [ ] Weighted service exists but UI/report flag OFF
- [ ] Exit READY_FOR_PHASE_13_WITH_BLOCKERS
- [ ] Related vitest PASS

---

## Plan self-review

Spec waves map to Tasks 0–4. No TBD blocking Wave 0. Commit steps omitted per global constraint.
