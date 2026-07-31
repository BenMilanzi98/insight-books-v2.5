# Phase 16 Gap Register

**Audited:** 2026-07-31  
**Inputs:** Phase 15 `PHASE_16_INPUTS.md`, Wave 0 audits, design/plan

| ID | Gap | Severity | Wave | Notes |
|----|-----|----------|------|-------|
| G16-01 | No CrmConversionRequest / CVR numbering | BLOCKER | 1 | Greenfield under `lib/admin/crm/conversions/*` |
| G16-02 | No versioned ConversionPlan + checksum | BLOCKER | 1 | Immutable plan versions + re-approval |
| G16-03 | No dryRunConversion (zero side effects) | BLOCKER | 1 | Preview record only |
| G16-04 | No executeClosedWonConversion orchestrator | BLOCKER | 1 | Approach 1 durable saga |
| G16-05 | No step durability / input hash / resume | BLOCKER | 1 | Exact retry + conflicting fail |
| G16-06 | Early Closed Won not wired as saga step | BLOCKER | 1 | Reuse Phase 12 `closeOpportunityWon` — CORRECT_AND_REUSABLE |
| G16-07 | Concurrency locks (accepted version / invoice / invite) | HIGH | 1 | Uniqueness + row locks |
| G16-08 | No conversion hub UI/APIs (thin stubs OK) | HIGH | 1 stubs → 4 | `/conversions*` NOT_FOUND |
| G16-09 | No Platform Customer match engine | BLOCKER | 2 | EXACT/HIGH/POSSIBLE/CONFLICT; CUSTOMER_DUPLICATION_RISK |
| G16-10 | No audited create-or-link Customer/Tenant decisions | BLOCKER | 2 | No auto-merge |
| G16-11 | Admin Tenant create NON_IDEMPOTENT + status active early | HIGH | 2 | Wrap with reserved slug + activation honesty |
| G16-12 | Business first-class create/link | MEDIUM | 2 | Often SKIPPED_NOT_APPLICABLE |
| G16-13 | Branch create/link under conversion lock | HIGH | 2 | CROSS_TENANT_RISK if unguarded |
| G16-14 | Hash-only user invitation (no temp password) | BLOCKER | 2 | PRIVILEGED_USER_RISK on admin create path |
| G16-15 | Isolation / security baseline assert | HIGH | 2 | |
| G16-16 | Accounting boundary (no journals/OB/AR) | HIGH | 2–3 | REUSE CoA init; FORBIDDEN journals |
| G16-17 | Snapshot-driven Subscription create/amend | BLOCKER | 3 | Closed Won ≠ ACTIVE |
| G16-18 | Entitlement qty ≤ accepted; no hidden grants | BLOCKER | 3 | |
| G16-19 | Billing Account/Schedule + Invoice from snapshot | BLOCKER | 3 | Reuse Platform Invoice idempotency |
| G16-20 | Payment initiation ≠ PAID boundary | BLOCKER | 3 | NOT_CONFIGURED typed when missing |
| G16-21 | Activation policy engine | BLOCKER | 3 | |
| G16-22 | Compensation engine (explicit) | HIGH | 1–4 | Never delete acceptance / paid |
| G16-23 | CS assignment step | HIGH | 4 | EXTEND portfolios |
| G16-24 | Onboarding/training/migration/MRA handoffs | HIGH | 4 | Handoff ≠ execute |
| G16-25 | Conversion reports / DQ / recon / reliability gate | HIGH | 4 | Never false zero |
| G16-26 | Weighted Pipeline UI unlock | DEFERRED | 4 | `WEIGHTED_PIPELINE_UI_ENABLED` false today |
| G16-27 | resolveCrmScope stub | CARRY | Harden | mode:all CROSS_TENANT_RISK |
| G16-28 | E-sign provider | CARRY | — | NOT_CONFIGURED — acceptance still valid |
| G16-29 | Prisma EPERM Windows | CARRY | All | SQL + hasCrm*Model |
| G16-30 | Rich conversion UI beyond stubs | MEDIUM | 1–4 | Thin stubs acceptable early |
| G16-31 | AI provisioning / auto-merge / fabricate PAID | FORBIDDEN | — | Never |
| G16-32 | Tenant Quotation / Tenant AR as conversion truth | PROCESS | All | WRONG_DOMAIN guards |
| G16-33 | Telephony / calendar / ingest / Demo cloud | CARRY | Orthogonal | NOT_AVAILABLE / NOT_CONNECTED |

**No TBD blocking Wave 1 after CONDITIONAL GO** — Phase 15 handoff/acceptance/readiness and Phase 12 close are CORRECT_AND_REUSABLE; conversion orchestrator is expected NOT_FOUND greenfield; Tenant/Subscription/billing FOUNDATION services exist for Waves 2–3 wrapping.
