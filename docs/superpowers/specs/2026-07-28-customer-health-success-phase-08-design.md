# Customer Health & Customer Success Phase 8 — Design

**Status:** Approved (conversation 2026-07-28); Wave 0 first  
**Date:** 2026-07-28  
**Surfaces:** `/insightbooks/intelligence/customer-health` · `/insightbooks/customer-success`  
**Architecture:** Approach B — dual Health Intelligence + CS Ops domains

---

## 1. Purpose

Deliver an **explainable, versioned Customer Health engine** and a **portfolio-scoped Customer Success operations workspace** on top of Phase 7 Customer 360, signals, and portfolios — without ML/black-box scores, invented activity, or Tenant GL exposure.

---

## 2. Locked decisions

| Topic | Decision |
|-------|----------|
| Sequencing | Wave 0 audits + matrices before engines/UI |
| Architecture | Dual: `lib/admin/health/*` + `lib/admin/customerSuccess/*` |
| Missing dimensions | **NOT_APPLICABLE + renormalise**; confidence declines; never score missing as 0 |
| Initial scored dims | Commercial, Engagement (login proxy), MRA EIS, Relationship (owner/signals) |
| N/A until instrumented | Adoption, Service/Support, Onboarding, Training (and NPS unless responses exist) |
| CS depth | Phased: Command Centre, Cases, Tasks, Interventions, Renewals, Playbook + Success Plan foundations; onboarding/training/surveys source-gated |
| Score | 0–100 + bands + **separate confidence**; not churn/renewal probability |
| Portfolio | Reuse Phase 7 `portfolioScope` |
| Automations | Deterministic + idempotent trigger identity |

---

## 3. Hard rules

- Explainable: version, weights, inputs, drivers, missing-data effects, confidence, recon.
- No black-box / ML / AI recommendations or outreach.
- No false zeroes; failed queries ≠ 0.
- CS actions do not mutate source facts (subs, payments, usage, EIS).
- Agents portfolio-scoped; no cross-tenant leakage.
- Renewal outcomes require authoritative subscription evidence.
- Onboarding/training completion not from page views / product activity alone.
- No full CRM opportunities; expansion = handoff record only.
- No auto plan upgrades / credits / refunds / cancellations.
- `/insightbooks/chart-of-accounts` stays removed.

---

## 4. Wave 0 — Forensic pack (docs only)

Create `docs/admin-intelligence-crm/phase-08/` with:

- README, PHASE_08_SCOPE, PHASE_INPUT_VALIDATION  
- CURRENT_* audits (health, CS, playbooks, tasks, renewals, onboarding, training, reviews, comms, escalations, surveys, reports, exports)  
- CUSTOMER_HEALTH_DATA_QUALITY / RECONCILIATION / SECURITY / PERFORMANCE audits  
- HEALTH_SOURCE_MATRIX, HEALTH_DEFINITION_MATRIX, HEALTH_MISSING_DATA_MATRIX  
- CS_WORKFLOW_MATRIX, CS_SECURITY_MATRIX  
- PHASE_08_GAP_REGISTER, IMPLEMENTATION_PLAN  
- FINAL_READINESS_DECISION (enter Wave 1)

Also document v1 Health formula: eligible dims only, EXCLUDE_AND_RENORMALISE, minimum evidence → UNKNOWN, critical overrides (suspended/cancelled/severe overdue).

---

## 5. Domain architecture

```text
Phase 7 360 + signals + portfolios
        → HealthDefinition (versioned)
        → Dimension evaluation
        → Confidence + critical overrides
        → HealthSnapshot (immutable, rebuildable)
        → CS Case (idempotent from signal/health)
        → PlaybookExecution / Tasks / Interventions
        → SuccessPlan / Goals / Outcomes
        → RenewalWorkspace (outcome ← subscription evidence)
        → ExpansionHandoff (no CRM opportunity)
```

### 5.1 Health bands

HEALTHY · STABLE · NEEDS_ATTENTION · AT_RISK · CRITICAL · UNKNOWN  

Thresholds live in definition config — not hardcoded in UI cards.

### 5.2 Confidence

HIGH · MEDIUM · LOW · INSUFFICIENT — independent of score.

### 5.3 Critical overrides (examples)

Subscription cancelled/suspended; severe overdue platform billing; MRA EIS entitlement revoked when EIS-dependent — cap/force CRITICAL per versioned rules; positive engagement remains visible as a dimension.

---

## 6. Libraries & APIs

- `lib/admin/health/` — definitions, dimensions, evaluate, confidence, snapshots, reconcile, pack  
- `lib/admin/customerSuccess/` — cases, tasks, interventions, playbooks, renewals, plans, goals, handoffs, automation  

APIs under:

- `/api/admin/intelligence/customer-health/*`  
- `/api/admin/customer-success/*`  

Auth: `systemAdmin.intelligence.customerHealth.*` + `systemAdmin.customerSuccess.*`; portfolio scope on lists/mutations.

---

## 7. UI routes

Health workbench + CS Command Centre and section routes per master prompt. Section pages matrix-gated. en/ny; Phase 2 Admin components; MetricCard envelopes.

---

## 8. Waves after Wave 0

| Wave | Focus |
|------|--------|
| 0 | Audits + matrices + readiness |
| 1 | Health definition model + engine + snapshots + APIs + tests |
| 2 | Health UI + CS shell/nav/i18n |
| 3 | Cases, tasks, interventions, idempotent automation, renewal workspaces |
| 4 | Playbooks, success plans/goals, onboarding/training/survey foundations, handoffs, export, Phase 9 pack |

---

## 9. Expected exit readiness

**READY_FOR_PHASE_9_WITH_BLOCKERS** if adoption/support/onboarding/training still uninstrumented but Health + core CS ops are safe and explicit.

---

## 10. Spec self-review

No open TBDs blocking Wave 0. Prisma model names follow repo conventions in Wave 1. Full prompt surface is wave-gated; invented progress forbidden.

---

## 11. Approval

Conversational design **approved** 2026-07-28.
