# Final Phase 8 Review — Customer Health + CS Ops

**Reviewer role:** Whole-phase gate (Waves 1–4)  
**Scope:** Working tree (commits deferred)  
**Date:** 2026-07-28  
**Evidence base:** Plan/design, SDD progress + task-1..4 reviews, FINAL phase-08 docs, spot-check of health/CS libs, authz, renewals/playbooks/cases, permissions, SQL, readiness pack  
**Tests:** Accepted as verified — `customerHealth` + `customerSuccess` = **30/30** Vitest PASS (not re-run this review)

---

## Verdict

**READY_FOR_PHASE_9_WITH_BLOCKERS** is justified.

Phase 8 delivers an explainable four-dimension health engine and portfolio-scoped CS ops (cases/tasks/interventions/renewals/playbooks/plans/handoffs/foundations/export) with hard rules held: missing ≠ 0, confidence separate from score, no churn probability, no Tenant Sale, CS does not mutate subscription/billing/EIS, foundations fail open as `NOT_INSTRUMENTED`, expansion handoffs are record-only.

**Assessment: Ready to commit when user asks? `yes with caveats`**

---

## Strengths

1. **Portfolio fail-closed for health-only readers** — `resolveHealthPortfolioScope` never grants fleet-wide lists without `customers.read`; empty ownership → `{ in: [] }`. List `tenantId` is gated via `assertHealthTenantAccess` before query.
2. **Health engine semantics match design** — EXCLUDE_AND_RENORMALISE; SCORED-only weights; null score + UNKNOWN/INSUFFICIENT when under-evidenced; SUSPENDED forceBand keeps CRITICAL even when score is null; disclaimer denies churn/renewal probability.
3. **CS open-case idempotency is coherent end-to-end** — soft open check + P2002 re-fetch; open-only partial unique in SQL; re-open after close allowed; automation is deterministic/on-demand.
4. **Playbook fail-closed + tenant integrity** — invalid/missing case rejected before execution create; task failures leave RUNNING (never empty COMPLETED); case/tenant mismatch rejected in playbooks and `createTask`.
5. **Source-fact boundaries held** — renewals only *read* `AccountSubscription`; no CS writes to subs/payments/EIS; handoffs serialize `recordOnly: true`; foundations always `progressPercent: null`.
6. **Permissions + nav wired** — `intel.customerHealth.*` and `customerSuccess.read|manageCases|manageRenewals` in `SYSTEM_ADMIN_PERMISSIONS` + `NAV_PERMISSION_MAP`; System CoA admin route remains removed.
7. **Exit docs are honest** — FINAL report / readiness checklist / Phase 9 inputs document adoption/support/onboarding/training blockers rather than papering them over.
8. **Task gate history is clean** — prior Critical/Important items (portfolio leaks, suspended+null band wipe, open-forever unique, playbook empty-COMPLETE) were fixed and re-approved in task reviews.

---

## Critical

None.

No open correctness or security defects that would block committing Phase 8 surfaces as delivered. Prior Critical findings from Waves 1–4 are closed in code.

---

## Important

### 1. Commit packaging — `prisma/schema.prisma` / `permissions.js` likely bundle Phase 7

Working tree shows large diffs (`schema.prisma` ~+677, `permissions.js` ~+173) against HEAD `7d9709a`. Phase 8 models/perms are present, but these files also carry earlier Customer 360 / portfolio / platform commercial surface that may not yet be committed.

**Caveat:** When the user asks to commit, stage deliberately (joint Phase 7+8 commit is OK if intentional; avoid accidental “Phase 8 only” messaging that omits bundled deps). Do not commit secrets. Prefer one coherent admin-intelligence commit set over a misleading partial commit that breaks schema/runtime.

### 2. Deploy must apply SQL partial unique for open-case idempotency

`CsCase` open-only uniqueness lives in `scripts/sql/customer-success-phase08.sql` (`CsCase_open_idempotencyKey_key` WHERE status IN OPEN/IN_PROGRESS). Prisma schema documents this and only has a non-unique `@@index([idempotencyKey])`. Soft check + P2002 help, but **without the SQL index concurrent races can create duplicate open cases**.

**Caveat:** Ops runbook / deploy checklist must apply `customer-health-phase08.sql` + `customer-success-phase08.sql` (especially under Windows Prisma EPERM / generate blockers already noted in FINAL docs).

### 3. Prisma generate / model-unavailable degradation remains an env risk

Libs degrade when Prisma client methods are missing (`UNAVAILABLE` / empty lists). Acceptable as documented Phase 8/9 blocker, but production readiness depends on generate + SQL apply — not on Vitest alone.

---

## Minor

1. **Renewals UI shows outcome actions to all CS readers** — `CustomerSuccessRenewalsView.jsx` does not gate buttons on `manageRenewals`; API/`setRenewalOutcome` correctly returns 403. UX polish only.
2. **CHURNED/LOST evidence accepts `SUSPENDED` (and similar) without requiring expiry** — `evaluateRenewalOutcomeEvidence` may be broader than “expired/cancelled/inactive” wording in some docs.
3. **`PENDING` outcome closes the workspace** — evidence helper allows PENDING without subscription proof; `setRenewalOutcome` still sets `status: CLOSED`. Product-semantics polish.
4. **CS_SECURITY_MATRIX lists `managePlaybooks` / `manageHandoffs`** — implementation correctly consolidates under `manageCases` + `manageRenewals` per plan; matrix is slightly stale.
5. **Foundation/stub pages** — direct-URL polish for empty foundation stubs is residual; APIs remain portfolio- and permission-gated.
6. **Automation is on-demand only** — no cron/outbox (by design for Phase 8).
7. **Playbook mid-loop failure after execution row exists** — leaves RUNNING (correct fail-closed); no dedicated regression beyond pre-create invalid-case path (acceptable residual).

---

## Spec / hard-rule compliance (phase rollup)

| Rule | Status |
|------|--------|
| Missing dims never scored as 0; confidence separate | ✅ |
| Health ≠ churn/renewal probability | ✅ |
| Portfolio scope on Health + CS reads/mutations | ✅ |
| CS does not mutate subs / billing / EIS | ✅ |
| Automations deterministic + idempotent | ✅ (SQL index required for race safety) |
| Renewal outcomes require subscription evidence | ✅ (PENDING exception; see Minor) |
| Adoption/support/onboarding/training N/A or source-gated | ✅ → expected WITH_BLOCKERS |
| Never Tenant Sale; System CoA admin route removed | ✅ |
| Expansion handoff record-only | ✅ |
| Exit READY_FOR_PHASE_9_WITH_BLOCKERS | ✅ |

---

## Known Phase 9 blockers (accepted, not reopen)

Documented in FINAL pack — do not invent before instrumenting:

- Adoption / FEATURE_USED unavailable  
- Unique-user DAU/WAU/MAU (login proxy only)  
- Support ticket plane NOT_INSTRUMENTED (CS case ≠ support)  
- Onboarding / training / survey empty → NOT_INSTRUMENTED  
- Full CRM opportunities out of scope  
- Export foundation only (no XLSX/PDF)

---

## Assessment

| Dimension | Result |
|-----------|--------|
| Spec compliance (Phase 8 exit) | **Approved** |
| Security / portfolio | **Approved** (with SQL deploy caveat) |
| Task-review residuals | Minors only; no open Critical/Important functional defects |
| Docs / readiness decision | **READY_FOR_PHASE_9_WITH_BLOCKERS** consistent with code |
| **Ready to commit when user asks?** | **yes with caveats** |

### Caveats before / at commit

1. Stage `prisma/schema.prisma` + `permissions.js` consciously (Phase 7+8 bundling).  
2. Ensure deploy applies Phase 8 SQL scripts (partial unique + tables).  
3. Minors (renewals UI gate, PENDING/CHURNED evidence polish, matrix doc drift) may ship as follow-ups — not commit blockers.  
4. Do not claim Phase 9 readiness without the documented instrumentation blockers.

**Commits remain deferred until the user explicitly asks.**
