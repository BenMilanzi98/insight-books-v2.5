# Plan Limit Audit

**Date:** 2026-07-28

## Current state

| Area | Finding | Classification |
|------|---------|----------------|
| Catalog features | String arrays on `SUBSCRIPTION_PLANS` | INCOMPLETE for limits |
| EISUsage / quotas | Legacy monthly usage tables | REUSE / REFACTOR |
| PlatformPlanVersion | `featuresJson` only; no structured limits | EXTEND |
| Enforcement | Partial via `hasEISAccess` + operational readiness | DISCONNECTED from plan limits |
| Retry/reprint exclusion from usage | Not evidenced for SaaS overage | GAP |

## Required

Structured limit catalogue (terminals, sites, businesses, monthly fiscal txs, API, storage, retention) with server enforcement and metering idempotency.
