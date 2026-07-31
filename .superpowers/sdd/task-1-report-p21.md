# Task 1 Report — Phase 21 Wave 1 Handoff validate/accept + Project spine harden

**Status:** COMPLETE  
**Date:** 2026-07-31  
**Gaps closed:** G21-01 … G21-06 (Wave 1)  
**Git commit:** none (per brief)

## Deliverables

| Item | Result |
|------|--------|
| `validateOnboardingHandoff` + checksum evaluate | Present — UNKNOWN / INVALID ≠ VALID |
| `acceptOnboardingHandoff` | Present — idempotent exact retry; portfolio fail-closed by id |
| Correction/supersession history on accept | Preserved on handoff payload; SUPERSEDED refuse |
| Project create harden | Template ACTIVE pin; ONB- number; one active Project; idempotency conflict |
| Invalid status transitions | Throw (existing machine; DRAFT→COMPLETED / PLANNING→LIVE|COMPLETED covered) |
| Vitest | `test/systemAdmin.cs.onboardingPhase21Wave1.test.js` **10/10 PASS** |
| Regression | `test/systemAdmin.cs.onboardingWave1.test.js` **10/10 PASS** |

## Key files

- `lib/admin/customerSuccess/onboarding/handoffConsume.js` — validate + accept
- `lib/admin/customerSuccess/onboarding/projects.js` — one-active + portfolio gate
- `lib/admin/customerSuccess/onboarding/projectAccess.js` — `assertOnboardingTenantInPortfolioScope`
- `lib/admin/customerSuccess/onboarding/catalogue.js` — `ONBOARDING_HANDOFF_VALIDATION_STATUS`
- `lib/admin/customerSuccess/onboarding/index.js` — exports
- `test/systemAdmin.cs.onboardingPhase21Wave1.test.js`

## Honesty preserved

- Accept does **not** create Project; does not mark execution COMPLETED; `onboardingCompleted` forced false.
- Checksum via Phase 20 `computeOnboardingHandoffChecksum` (emit SoT).
- No second onboarding domain.

## Stop / next

SDD review gate before Wave 2 (readiness honesty + accounting boundary).
