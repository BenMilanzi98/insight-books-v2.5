# Phase 12 Inputs — from CRM Core Phase 11

**Source exit:** `READY_FOR_PHASE_12_WITH_BLOCKERS` (see `FINAL_PHASE_11_REPORT.md`)  
**Date:** 2026-07-30

## What Phase 12 may consume

| Input | Location / contract | Notes |
|-------|---------------------|-------|
| Opportunity readiness handoff | `evaluateOpportunityReadiness` → `handoffPayload` | Typed payload; `opportunityId` always null in Phase 11 |
| Idempotency key | `handoffPayload.idempotencyKey` | `opp-ready:{leadId}:{qualVersion}:{scoreVersion}` |
| Lead / Account / Contact ids | Payload fields | Preserve Crm* identity; do not alias Customer |
| Score / qualification versions | Pinned version strings | Deterministic; not probability / Revenue |
| Merge evidence | `CrmMergeRequest.evidenceJson` | Survivor/loser IDs + history refs preserved |
| Consent / DNC | `CrmConsentRecord`, `CrmDoNotContact`, eligibility | Never infer GRANTED |
| Capture sources | Distinct source codes | Email/WhatsApp still NOT_AVAILABLE |

## What Phase 12 must not assume

- Opportunities / Pipelines already exist in Phase 11 (they do not)
- Email or WhatsApp inbound Lead volume (NOT_AVAILABLE)
- Full import success rates or funnel conversion % (FOUNDATION / honesty gates)
- CRM Account billing/MRR as Customer truth
- Contact grants Platform User access automatically
- Silent merges or self-approved merges

## Suggested Phase 12 scope seeds

1. Opportunity create from READY handoff only (consume idempotency key)
2. Pipeline stages + forecasting (no fabricated zeroes)
3. Lead → Tenant conversion transaction (if in scope)
4. Email / WhatsApp ingest contracts → producers (or keep NOT_AVAILABLE)
5. Full import + reporting beyond JSON/CSV foundation
6. Harden owner/team/territory list scope filtering

## Carry gaps (from Phase 11 gap register)

- G11-16 Email → Lead ingest (DEFERRED)
- G11-17 WhatsApp → Lead (DEFERRED)
- G11-23 Lead → Tenant conversion (CARRY)
- G11-24 Opportunities / forecasting / proposals (CARRY → Phase 12+)

## Honesty gates to preserve

- Empty recon / export ≠ invent rows or KPI zeroes
- Score ≠ probability / expected revenue
- Opportunity create only when readiness READY (and Phase 12 owns create)
