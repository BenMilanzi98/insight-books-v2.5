# Phase 20 Readiness Checklist — from Phase 19

**Exit gate:** `READY_FOR_PHASE_20_WITH_BLOCKERS`  
**Date:** 2026-07-31

## Must be true before Phase 20 starts consuming Adoption

- [x] Canonical Request/Plan domain under `lib/admin/customerSuccess/adoption/**`
- [x] Auto Request only from Training Program aggregate COMPLETED; WITH_GAPS/partial never auto-create
- [x] Plan COMPLETED gated by evaluation policy + manage/portfolio authz
- [x] Phase 9 evidence honesty (no invented MET/zeroes)
- [x] Phase 8 interventions linked, not duplicated; Success Plan link or UNKNOWN
- [x] Expansion handoff ≠ execute billing/entitlements
- [x] List/search/export/DQ/metrics/My Work fail-closed portfolio scope
- [x] Reliability gate fail → UNAVAILABLE / `value: null` (never false zero)
- [x] Vitest Waves 1–4 green (WORKING_TREE)
- [x] Phase 20 input pack documents carry blockers honestly
- [x] EN + NY `customerSuccess.adoptionHub.*` keys present

## Explicit blockers carried into Phase 20

- [ ] Virtual meeting provider configured (Phase 18)
- [ ] Session recording delivered (Phase 18)
- [ ] Rich LMS / question banks (Phase 18 optional)
- [ ] Customer training portal (Phase 18)
- [ ] Payment / e-sign providers (Phase 16 carry)
- [ ] Advanced ML churn scoring (Phase 19 optional — out of Wave 4)
- [ ] Rich customer self-serve adoption portal (Phase 19 optional)
- [ ] Deep renewals execute beyond handoff ACK (Phase 20+)

## Stop conditions

- Do not invent KPI zeroes on reliability gate failure
- Do not treat Phase 8 Success Plan COMPLETED as Adoption Plan COMPLETED without linked Plan evidence
- Do not execute Subscription / entitlement / invoice / Tenant GL from Adoption
- Do not start Phase 20 until this checklist + `PHASE_20_INPUTS.md` are accepted
