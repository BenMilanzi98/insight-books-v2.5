# Phase 23 Implementation Plan

**Date:** 2026-08-01

## Wave 0 — Forensic audit (COMPLETE)

- [x] Inventory routes/models
- [x] Mislabel + compatibility maps
- [x] Gap register
- [x] Readiness = BLOCKED

## Wave 1 — Domain contracts & schema foundation (COMPLETE 2026-08-01)

1. [x] Marketing Campaign + numbering (MKT-YYYY-######)
2. [x] Channel / Source / Medium catalogues + normalisation rule versions
3. [x] Permissions skeleton `systemAdmin.marketing.*`
4. [x] Nav shell `/insightbooks/marketing` (overview with UNAVAILABLE — never fake zeros)
5. [x] Safe URL + UTM capture contracts + tests
6. [x] Read CRM Lead source evidence without a second Lead Source SoT

Shipped: `lib/admin/marketing/*`, `/api/admin/marketing/*`, `/insightbooks/marketing/*`, migration `20260801160000_phase23_marketing_wave1`, vitest `test/systemAdmin.marketing.wave1.*.test.js`.

## Wave 2 — Capture plane

Landing pages, Forms, submissions→Lead idempotency, Visitor+consent+Session, Touchpoints, identity resolution.

## Wave 3 — Acquisition linkage

Lead acquisition facts, Opportunity sourced/influenced, Customer/subscription new vs expansion.

## Wave 4 — Spend & attribution engine

Spend facts, currency, allocation, immutable model/window versions, runs+credits (100%), all deterministic models, exceptions+recon.

## Wave 5 — Funnels, metrics, UI, reports

Funnels/cohorts, CPL/CAC/ROAS (UNAVAILABLE on missing inputs), campaign UI, reports/exports, EN+NY, a11y/security tests, Phase 24 pack.

## Stop conditions

Never invent impressions/clicks/sessions/spend/revenue/CAC/ROAS; never Training→Lead or Product→Touch without evidence; never accounting journals from spend; never a second Campaign/Lead-Source/visitor system.
