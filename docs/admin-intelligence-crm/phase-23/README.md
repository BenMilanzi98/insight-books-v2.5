# Phase 23 — Marketing Attribution and Acquisition Analytics

**Date:** 2026-08-01  
**Authoritative PRD phase:** 23  
**Current readiness:** **BLOCKED** (forensic Wave 0 complete; domain not implemented)

## Purpose

Establish one canonical Marketing Attribution domain under `/insightbooks/marketing/*` without duplicating CRM Lead Source, Affiliate referral, Product Analytics, Training, or Demo systems.

## Wave 0 status (this pack)

| Domain | Status |
|--------|--------|
| `/insightbooks/marketing/*` routes | **MISSING** (0 routes) |
| Marketing Campaign model | **MISSING** |
| Channel / Source / Medium catalogues | **MISSING** (CRM free-text `source`+`channel` on Lead) |
| UTM / visitor / marketing session / touchpoint | **MISSING** |
| Attribution models / runs / credits | **MISSING** |
| Marketing spend facts | **MISSING** |
| CRM Lead source + capture + consent | **REUSE** (Phases 14–15) |
| Affiliate referral program | **DISTINCT** — not Marketing Campaign SoT |
| Product Analytics funnels | **DISTINCT** — Product Events ≠ Marketing touchpoints |
| Training | **BOUNDARY** — attendance ≠ acquisition (Phase 22) |

## Start here

1. `CURRENT_MARKETING_ARCHITECTURE_AUDIT.md`
2. `PHASE_23_GAP_REGISTER.md`
3. `IMPLEMENTATION_PLAN.md`
4. `FINAL_READINESS_DECISION.md`

## Non-goals (Wave 0)

No Campaign schema, attribution engine, or fabricated metrics in Wave 0.
