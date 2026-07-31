# Phase 20 Scope — Lead Conversion / Closed-Won

**PRD:** Phase 20 — Lead Conversion and Won Workflow (`Inteligence & Leads.txt` §Phase 20)  
**Canonical code:** `lib/admin/crm/conversions/**`, Prisma `CrmConversion*`, UI/API under `/insightbooks/crm/conversions` and `app/api/admin/crm/conversions/**`  
**Tree alias:** `docs/admin-intelligence-crm/phase-16/` (prior Closed-Won Conversion pack)  
**Docs home:** `docs/admin-intelligence-crm/phase-20/`

## In scope

1. Forensic mapping of PRD 14–22 vs tree phase folders; quarantine CS tree 17–19 as FUTURE/MISLABELLED.
2. Harden Closed-Won readiness, acceptance, authority, approvals (Wave 1).
3. Harden conversion create/execute idempotency, commercial snapshot immutability, Customer/Contact duplicate gates (Wave 2).
4. Harden provisioning/subscription/entitlement/tenant/user **request** honesty + onboarding handoff (Wave 3).
5. UI queues/metrics/reliability/DQ/recon/exports + Phase 21 input pack + exit `READY_FOR_PHASE_21_WITH_BLOCKERS` (Wave 4).

## Explicitly out of scope

| Item | Why |
|------|-----|
| Full CS Onboarding Project execution | PRD 21 / tree phase-17 — FUTURE |
| Customer Training / Adoption management | Tree phase-18/19 — FUTURE |
| Deleting or renumbering CS folders/code | Preserve; banner only |
| Parallel `SalesConversion*` domain | Forbidden (Approach 1) |
| Adoption `PHASE_20_INPUTS` renewals | NON_AUTHORITATIVE for PRD 20 |
| Tenant GL / OB / journals / MRA fiscal submit | Forbidden |
| AI sales assistant / Support / infra monitoring | Orthogonal |

## Boundaries (honesty)

| Claim | Truth |
|-------|-------|
| Closed-Won | Opportunity terminal win + conversion saga start — not ACTIVE, not PAID, not onboarding complete |
| Conversion COMPLETED | Saga certificate after steps — not equal to Closed-Won alone |
| Onboarding handoff | Payload + checksum for PRD 21 — does **not** create Onboarding Project |
| Provisioning request | Pending until platform service returns — never fabricate ACTIVATED/PROVISIONED/PAID |
| Acceptance | Evidence-bound commercial version — never inferred from view/open/silence |

## Upstream inputs (authoritative for PRD 20)

- Tree phase-15 Commercial acceptance / Closed-Won readiness / handoff (`lib/admin/crm/commercial/**`)
- Pipeline `closeOpportunityWon` (`lib/admin/crm/opportunities/close.js`)
- Tree phase-16 conversion exit `READY_FOR_PHASE_17_WITH_BLOCKERS` + spine already in WORKING_TREE
- Platform Customer / Tenant / Subscription / invitation services (typed unavailable when missing)

## Downstream

Phase 21 consumes canonical onboarding handoff (identity, commercial snapshot, contacts, scopes, ownership, dates, success criteria, reliability checksum) and owns onboarding execution.
