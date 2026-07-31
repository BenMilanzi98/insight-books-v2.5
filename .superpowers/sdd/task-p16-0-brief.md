### Task 0: Wave 0 — Forensic audits + matrices + readiness

**Depends on:** Phase 15 exit `READY_FOR_PHASE_16_WITH_BLOCKERS`; approved Phase 16 design + plan.

**Do NOT write application code, Prisma models, APIs, UI, or SQL migrations.** Docs under `docs/admin-intelligence-crm/phase-16/` only.

**Do NOT git commit** (user must request commits).

## Required deliverables

Create non-empty docs with real findings (paths, classifications, evidence). Match Phase 15 Wave 0 style. At minimum:

```
docs/admin-intelligence-crm/phase-16/
├── README.md
├── PHASE_16_SCOPE.md
├── PHASE_INPUT_VALIDATION.md
├── CURRENT_CONVERSION_ARCHITECTURE_AUDIT.md
├── CURRENT_CLOSED_WON_WORKFLOW_AUDIT.md
├── CURRENT_CUSTOMER_CREATION_AUDIT.md
├── CURRENT_CUSTOMER_DUPLICATE_AUDIT.md
├── CURRENT_TENANT_PROVISIONING_AUDIT.md
├── CURRENT_BUSINESS_PROVISIONING_AUDIT.md
├── CURRENT_BRANCH_PROVISIONING_AUDIT.md
├── CURRENT_CONTACT_CONVERSION_AUDIT.md
├── CURRENT_USER_INVITATION_AUDIT.md
├── CURRENT_SUBSCRIPTION_PROVISIONING_AUDIT.md
├── CURRENT_ENTITLEMENT_PROVISIONING_AUDIT.md
├── CURRENT_PLATFORM_BILLING_AUDIT.md
├── CURRENT_PLATFORM_INVOICE_AUDIT.md
├── CURRENT_PAYMENT_INITIATION_AUDIT.md
├── CURRENT_ACTIVATION_POLICY_AUDIT.md
├── CURRENT_CUSTOMER_SUCCESS_ASSIGNMENT_AUDIT.md
├── CURRENT_ONBOARDING_HANDOFF_AUDIT.md
├── CURRENT_TRAINING_HANDOFF_AUDIT.md
├── CURRENT_DATA_MIGRATION_HANDOFF_AUDIT.md
├── CURRENT_MRA_EIS_HANDOFF_AUDIT.md
├── CURRENT_CONVERSION_IDEMPOTENCY_AUDIT.md
├── CURRENT_CONVERSION_RECOVERY_AUDIT.md
├── CURRENT_CONVERSION_RECONCILIATION_AUDIT.md
├── CONVERSION_DATA_QUALITY_AUDIT.md
├── CONVERSION_PRIVACY_AUDIT.md
├── CONVERSION_SECURITY_AUDIT.md
├── CONVERSION_PERFORMANCE_AUDIT.md
├── CONVERSION_SOURCE_MATRIX.md
├── CONVERSION_DOMAIN_MATRIX.md
├── CONVERSION_TYPE_MATRIX.md
├── CONVERSION_STEP_MATRIX.md
├── CUSTOMER_MATCH_MATRIX.md
├── TENANT_ACTION_MATRIX.md
├── SUBSCRIPTION_ACTION_MATRIX.md
├── ENTITLEMENT_MATRIX.md
├── BILLING_MATRIX.md
├── ACTIVATION_POLICY_MATRIX.md
├── HANDOFF_MATRIX.md
├── COMPENSATION_MATRIX.md
├── CONVERSION_RELIABILITY_MATRIX.md
├── CONVERSION_SECURITY_MATRIX.md
├── PHASE_16_GAP_REGISTER.md
├── IMPLEMENTATION_PLAN.md
└── FINAL_READINESS_DECISION.md
```

Classification legend (use as applicable): CORRECT_AND_REUSABLE, REUSE_WITH_RECONCILIATION, EXTEND, FOUNDATION, NOT_FOUND, WRONG_DOMAIN, NON_IDEMPOTENT, CUSTOMER_DUPLICATION_RISK, TENANT_DUPLICATION_RISK, SUBSCRIPTION_DUPLICATION_RISK, BILLING_DUPLICATION_RISK, PARTIAL_CONVERSION_RISK, CROSS_TENANT_RISK, PAYMENT_TRUTH_RISK, ACCOUNTING_SIDE_EFFECT_RISK, PRIVILEGED_USER_RISK, BLOCKED, NOT_AVAILABLE, NOT_APPLICABLE.

## Validate inputs

- `docs/admin-intelligence-crm/phase-15/PHASE_16_INPUTS.md`
- `docs/admin-intelligence-crm/phase-15/PHASE_16_READINESS_CHECKLIST.md`
- `docs/admin-intelligence-crm/phase-15/FINAL_PHASE_15_REPORT.md`
- Design: `docs/superpowers/specs/2026-07-31-closed-won-conversion-phase-16-design.md`
- Plan: `docs/superpowers/plans/2026-07-31-closed-won-conversion-phase-16.md`

Explore: Phase 15 handoff/readiness/acceptance; Phase 12 closeOpportunityWon; existing Tenant/Subscription/billing/invite services; no `/conversions*` yet; WEIGHTED_PIPELINE_UI_ENABLED false.

## Locked design (must reflect)

- Early Closed Won in durable execution; Approach 1 durable saga; orchestrator reuses existing provisioners
- Payment boundary + existing providers; Approach B waves
- Expected decision: **CONDITIONAL GO** for Wave 1 unless true BLOCKED
- Handoff ≠ create; dry run no side effects; no Tenant GL; no fabricate PAID/ACTIVE

## Acceptance

- [ ] All listed docs exist with real findings
- [ ] Phase input validation recorded
- [ ] Gap register + IMPLEMENTATION_PLAN maps gaps → Waves 1–4
- [ ] FINAL_READINESS_DECISION records CONDITIONAL GO or BLOCKED
- [ ] No application code written
- [ ] No git commit

## Report

Write full report to `.superpowers/sdd/task-p16-0-report.md`. Return only status, one-line summary, concerns, report path.
