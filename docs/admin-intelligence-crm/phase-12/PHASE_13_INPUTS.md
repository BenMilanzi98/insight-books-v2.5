# Phase 13 Inputs — from Sales Pipeline Phase 12

**Source exit:** `READY_FOR_PHASE_13_WITH_BLOCKERS` (see `FINAL_PHASE_12_REPORT.md`)  
**Date:** 2026-07-30

## What Phase 13 may consume

| Input | Location / contract | Notes |
|-------|---------------------|-------|
| ACTIVE Pipelines | `NEW_BUSINESS`, `EXPANSION`, `MRA_EIS` catalogue + optional SQL seeds | Version strings pinned; shared stage codes |
| CrmOpportunity | Prisma + Wave 1–4 fields | ≠ Lead ≠ Customer ≠ Subscription ≠ Invoice |
| READY handoff create | `createOpportunityFromHandoff` | Idempotent `handoffIdempotencyKey` |
| Audited import | `previewOpportunityImport` / `confirmOpportunityImport` | `importIdempotencyKey`; honesty gates |
| Stage transition service | `transitionOpportunityStage` | Server-governed; history immutable |
| Closed Won / Lost | `closeOpportunityWon` / `closeOpportunityLost` | Evidence required; **no provision** |
| Proposal readiness handoff | `evaluateProposalReadiness` | Payload only — never creates Proposal |
| Conversion readiness handoff | `evaluateConversionReadiness` | Payload only — never executes conversion |
| Opportunity merge evidence | `CrmMergeRequest` + `entityType: OPPORTUNITY` | SoD; survivor/loser + history refs |
| Pipeline reports | `getPipelineReport` | Currency-separated; empty → EMPTY/UNAVAILABLE |
| Report schedules | `CrmPipelineReportSchedule` / `CrmPipelineReportRun` | Audited runs |
| Weighted helper (dark) | `computeIndicativeWeightedAmount` | Flag OFF until Phase 16 |

## What Phase 13 must not assume

- Weighted Pipeline UI or weighted report totals are enabled (Phase 16)
- Closed Won already provisions Tenant / Subscription / Invoice
- Opportunity amounts are Phase 6 Revenue / MRR / ARR
- Owner/team/territory scope filtering is fully implemented (`resolveCrmScope` stub)
- Silent FX rollups across currencies
- Import or funnel success percentages exist
- Email / WhatsApp inbound Lead volume (still NOT_AVAILABLE)
- Analytics-pipeline health equals sales Pipeline

## Suggested Phase 13 scope seeds

1. Proposal create from proposal-readiness handoff (if Phase 13 owns proposals)
2. Conversion / Tenant create transaction from conversion-readiness (human-gated)
3. Harden owner/team/territory opportunity scope filtering
4. Competitor / partner Opportunity attachments (if in scope)
5. Keep weighted UI dark unless Phase 16 is pulled forward intentionally

## Carry gaps (from Phase 12)

- Weighted Pipeline UI/reports → Phase 16
- Scope filtering stub → harden in ops waves
- Competitor/partner optional depth
- Account/Contact merge still deferred
- Email/WhatsApp Lead ingest NOT_AVAILABLE
- Prisma EPERM on Windows generate/push

## Honesty gates to preserve

- Empty Pipeline report ≠ invent stage/win/loss zeroes
- Import successRate always null / forbidden
- Multi-currency totals separated or UNAVAILABLE
- Closed Won ≠ provision
- Score / probability remain explainable — not ML certainty / not Revenue
