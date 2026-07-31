# Phase 16 — Closed-Won Conversion

**Surface:** `/insightbooks/crm/conversions` (+ conversion-requests, conversion-approvals, conversion-reports; thin deep-links into existing customer/subscription/billing admin)

**Architecture:** Approach 1 — durable step saga under one CRM conversion orchestrator (`lib/admin/crm/conversions/*`); reuse existing Tenant / Subscription / Platform Invoice / invitation services

**Design:** `docs/superpowers/specs/2026-07-31-closed-won-conversion-phase-16-design.md`

**Plan:** `docs/superpowers/plans/2026-07-31-closed-won-conversion-phase-16.md`

**Handoff in:** `docs/admin-intelligence-crm/phase-15/PHASE_16_INPUTS.md`

**Phase 15 exit:** `READY_FOR_PHASE_16_WITH_BLOCKERS`

**Wave 0 decision:** **CONDITIONAL GO** for Wave 1 — see `FINAL_READINESS_DECISION.md`

## Wave status

| Wave | Focus | Status |
|------|-------|--------|
| 0 | Forensic audits + matrices + readiness | Complete (2026-07-31) |
| 1 | Conversion request/readiness/dry-run/plan + orchestrator + step durability + Closed Won early lock | Not started |
| 2 | Customer match/create-link + Tenant/Business/Branch + invitations + isolation | Not started |
| 3 | Subscription/entitlements + billing/invoice/payment boundary + activation | Not started |
| 4 | CS + onboarding/training/migration/MRA handoffs + hubs/reports/DQ/recon + weighted Pipeline UI + Phase 17 pack | Done 2026-07-31 |

## Hard rules

- CRM Account ≠ Platform Customer ≠ Tenant ≠ Business ≠ Branch
- Subscription ≠ Entitlement ≠ Platform Invoice ≠ Tenant Invoice
- Closed Won ≠ Payment ≠ Subscription ACTIVE ≠ Onboarding/Training complete
- Accepted Quotation ≠ Active Subscription
- Phase 15 handoff ≠ create; dry run = zero operational side effects
- Exact retry returns existing Conversion/resources; conflicting idempotency fails visibly
- Compensation explicit — no blind deletes of active Customers, paid Invoices, or acceptance evidence
- No Tenant Journals / opening balances / stock / AR / revenue / tax postings from conversion
- No Production MRA EIS credentials or fiscal submission during conversion
- No automatic Customer/Tenant merges; no fabricated PAID/ACTIVE
- Metric/report gate fail → never fabricated zero
- System `/insightbooks/chart-of-accounts` stays removed
- `WEIGHTED_PIPELINE_UI_ENABLED` capability true; unlock via `resolveWeightedPipelineUiAccess` (honesty + currency); indicative ≠ Revenue
- Exit: **READY_FOR_PHASE_17_WITH_BLOCKERS** — see `FINAL_PHASE_16_REPORT.md`

## Classification legend

| Class | Meaning |
|-------|---------|
| CORRECT_AND_REUSABLE | Keep as boundary / input; do not redefine |
| REUSE_WITH_RECONCILIATION | Reuse only with explicit mapping / honesty |
| EXTEND | Reuse and extend under conversion domain |
| FOUNDATION | Thin foundations present; needs Wave work |
| NOT_FOUND | Absent in codebase / schema |
| WRONG_DOMAIN | Exists but belongs to another plane |
| NON_IDEMPOTENT | Exists but lacks conversion-grade idempotency |
| CUSTOMER_DUPLICATION_RISK | Risk of duplicate Platform Customer |
| TENANT_DUPLICATION_RISK | Risk of duplicate Tenant / slug collision |
| SUBSCRIPTION_DUPLICATION_RISK | Risk of duplicate active Subscription |
| BILLING_DUPLICATION_RISK | Risk of duplicate Platform Invoice / Payment |
| PARTIAL_CONVERSION_RISK | Mid-saga failure leaves partial state |
| CROSS_TENANT_RISK | Scope / isolation gap |
| PAYMENT_TRUTH_RISK | Initiation treated as PAID / fabricated status |
| ACCOUNTING_SIDE_EFFECT_RISK | Tenant GL / journals / balances from conversion |
| PRIVILEGED_USER_RISK | Default passwords / Super Admin / raw tokens |
| BLOCKED | Cannot proceed until dependency cleared |
| NOT_AVAILABLE | Explicitly deferred with contract |
| NOT_APPLICABLE | Out of conversion plane |
| FORBIDDEN | Must not be used / invented for this phase |

## Pack index

Audits (`CURRENT_*`, `CONVERSION_*`), matrices, `PHASE_16_GAP_REGISTER.md`, `IMPLEMENTATION_PLAN.md`, `FINAL_READINESS_DECISION.md` — see directory listing / Task 0 brief.
