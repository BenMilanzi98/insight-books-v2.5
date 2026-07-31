# Phase 21 Readiness Checklist — from Phase 20

**Exit gate:** `READY_FOR_PHASE_21_WITH_BLOCKERS`  
**Date:** 2026-07-31

## Must be true before Phase 21 starts consuming conversion handoffs

- [x] Compatibility map documents PRD ↔ tree numbering; CS 17–19 quarantined, not deleted
- [x] One canonical Conversion domain (`CrmConversion*` / `lib/admin/crm/conversions/**`)
- [x] Closed-Won readiness server-authoritative; UNKNOWN ≠ READY
- [x] Acceptance + authority + approvals block invalid Closed-Won
- [x] Conversion create/execute idempotent and resumable
- [x] Commercial snapshot immutable + checksum
- [x] Customer/Contact duplicates prevented (no auto-merge)
- [x] Requests not fabricated as ACTIVATED/PROVISIONED
- [x] One onboarding handoff path; handoff ≠ Project execution
- [x] Reliability gate never false zero; sales-team/territory/customer/tenant scopes fail-closed
- [x] Search/export/DQ/recon never invent zeroes / `lineageIntact: true`
- [x] Closed-Won / accepted value not labelled collected/recognised Revenue
- [x] Vitest Waves 1–4 green for hardened gaps
- [x] Phase 21 input pack documents handoff contract + carry blockers + mislabel map pointer
- [x] EN + NY `crm.conversionHub.*` keys present

## Explicit blockers carried into Phase 21

- [ ] Payment provider configured
- [ ] E-sign provider configured
- [ ] Full Onboarding Project execution (PRD 21 / CS tree-17 consumer)
- [ ] Training / migration / MRA fiscal execution from handoffs
- [ ] Rich scheduled-report polish
- [ ] Full Closed-Won UI beyond thin aliases (if deferred)
- [ ] Prisma EPERM Windows generate/push resolved (SQL fallback OK)

## Stop conditions

- Do not invent KPI zeroes on reliability gate failure
- Do not invent `lineageIntact: true` without instrumentation
- Do not create Onboarding Projects from Phase 20 conversion emission alone
- Do not treat accepted / Closed-Won value as collected or recognised Revenue
- Do not start Phase 21 execute until this checklist + `PHASE_21_INPUTS.md` are accepted
