# Phase 19 Inputs — from Customer Training Phase 18

**Source exit:** `READY_FOR_PHASE_19_WITH_BLOCKERS` (see `FINAL_PHASE_18_REPORT.md`)  
**Date:** 2026-07-31

## What Phase 19 may consume

| Input | Location / contract | Notes |
|-------|---------------------|-------|
| CustomerTrainingRequest / Program spine | `lib/admin/customerSuccess/training/*` | TRQ + TRN durable; handoff ≠ request ≠ program |
| Phase 16 TRAINING handoff consume | `handoffConsume.js` | Idempotent; never fabricates trainingCompleted |
| Participants / enrolment / trainers / cohorts | Wave 2 services | Verified identity; UNKNOWN ≠ restricted access |
| Sessions ↔ Phase 13 Meetings | `sessions.js`, `conflicts.js` | RSVP ≠ attendance; virtual provider typed unavailable |
| Attendance / materials / environment | Wave 2 | Production data forbidden in practice env |
| Exercises / assessments / attempts / grading | Wave 3 | Answers not in list payloads; final results immutable without regrade |
| Completion + certificates | `completion.js`, `certificates.js` | Checksum stable; not professional accreditation |
| Phase 17 onboarding feed | `onboardingFeed.js` | Does **not** mark onboarding Project COMPLETED |
| Health / progress / metrics | `health.js`, `progress.js`, `metrics.js` | Gate fail → UNAVAILABLE / `value: null` |
| DQ / recon / lineage | `dataQuality.js`, `reconciliation.js`, `lineage.js` | Never invent zeroes |
| Reports / exports / search | `reports.js`, `exports.js`, `search.js` | Answers/tokens/restricted materials stripped |
| Phase 8 foundation link | `phase8Migrate.js`, `foundations.js` | Program when linked; UNKNOWN if unresolved |
| EN + NY hub keys | `locales/*/admin-pages.json` `customerSuccess.trainingHub.*` | Smoke-covered |

## What Phase 19 must not assume

- Virtual meeting provider is configured (`VIRTUAL_PROVIDER_NOT_CONFIGURED`)
- Session recording / rich LMS question banks are delivered
- Customer training portal is configured
- Payment / e-sign providers are configured (Phase 16 carry)
- Reliability gate failures may be rendered as zero KPIs
- Phase 8 historical `CsTrainingRecord.status=COMPLETED` implies Program COMPLETED
- Training complete implies onboarding Project COMPLETED
- Certificate equals professional accreditation

## Suggested Phase 19 scope seeds

1. Deepen Customer Success expansion / renewals plane consuming Training outcomes honestly
2. Optional: wire virtual provider + recording when configured (typed until then)
3. Optional: rich assessment authoring / question banks (out of Wave 4 thin path)
4. Optional: Customer training portal evidence path
5. Keep invent-zeroes / handoff≠execute / accounting boundary / certificate checksum invariants

## Carry gaps (explicit blockers)

- Virtual provider → `VIRTUAL_PROVIDER_NOT_CONFIGURED`
- Session recording → not delivered
- Rich LMS authoring / question banks → optional gap
- Customer training portal → typed unavailable if referenced
- Payment provider / e-sign → `NOT_CONFIGURED` (Phase 16 carry)
- Prisma EPERM on Windows generate/push → SQL fallback (`scripts/sql/cs-training-phase18-wave4.sql`)
- Rich UI polish beyond thin AdminShell hubs → product waves
- AI-generated curricula / ML health → out of scope

## Honesty gates to preserve

- Gate fail → `UNAVAILABLE` with `value: null` — never false zero
- Training COMPLETED only from Training-domain evidence
- Phase 8 link or UNKNOWN — never invent Program COMPLETED from legacy rows
- Progress % ≠ completion; certificate checksum idempotent
- No Tenant GL / entitlement mutations from Training
- No answers / tokens / restricted materials in search / exports / general documents
- Onboarding feed must not auto-complete onboarding Project
