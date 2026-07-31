# Phase 18 Inputs — from Customer Onboarding Phase 17

**Source exit:** `READY_FOR_PHASE_18_WITH_BLOCKERS` (see `FINAL_PHASE_17_REPORT.md`)  
**Date:** 2026-07-31

## What Phase 18 may consume

| Input | Location / contract | Notes |
|-------|---------------------|-------|
| CustomerOnboardingRequest / Project spine | `lib/admin/customerSuccess/onboarding/*` | ONR + ONB durable; handoff ≠ request ≠ project |
| Phase 16 ONBOARDING handoff consume | `handoffConsume.js` | Idempotent; executionStatus remains NOT_STARTED at emit |
| Template versions + materialisation | `templates.js`, `materialise.js` | ACTIVE immutable once applied |
| Kick-off ↔ Phase 13 Meeting | `kickoff.js` | RSVP ≠ attendance; fail closed if Meeting unavailable |
| Customer task evidence attestation | `evidence.js` | Portal typed `CUSTOMER_PORTAL_NOT_CONFIGURED` |
| Training coordination row | `training.js` | COMPLETED requires Phase 18 Training-domain source |
| Migration / MRA coordination | `migration.js`, `mraEis.js` | Engine / fiscal NOT_AVAILABLE; recon gate |
| Go-live → stabilisation → handover | `goLive.js`, `stabilisation.js`, `handover.js` | Success → STABILISATION not COMPLETED |
| Completion certificate | `completion.js` | Checksum stable; progress ≠ completion |
| Health / progress / metrics | `health.js`, `progress.js`, `metrics.js` | Gate fail → UNAVAILABLE / `value: null` |
| DQ / recon / lineage | `dataQuality.js`, `reconciliation.js`, `lineage.js` | Never invent zeroes |
| Reports / exports | `reports.js`, `exports.js` | Credentials stripped; permission recheck |
| Phase 8 foundation link | `phase8Migrate.js`, `foundations.js` | Project when linked; UNKNOWN if unresolved |
| EN + NY hub keys | `locales/*/admin-pages.json` `customerSuccess.onboardingHub.*` | Smoke-covered |

## What Phase 18 must not assume

- Customer evidence portal is configured
- Training engine can mark DELIVERED/COMPLETED/PASSED/CERTIFIED from onboarding alone
- Full data-migration engine is available or upload ≡ complete
- MRA EIS Production fiscal submission is authorised from onboarding
- Payment / e-sign providers are configured (carry from Phase 16)
- Reliability gate failures may be rendered as zero KPIs
- Phase 8 historical `CsOnboardingRecord.status=COMPLETED` implies Project COMPLETED

## Suggested Phase 18 scope seeds

1. **Customer Training Management** — consume onboarding training coordination; declare DELIVERED/COMPLETED/PASSED/CERTIFIED only from Training domain
2. Trainer capacity, assessments, training certificates
3. Optional: deepen Customer portal evidence path (replace `CUSTOMER_PORTAL_NOT_CONFIGURED`)
4. Optional: wire migration engine callbacks → recon gates (still no fabricate complete)
5. Keep invent-zeroes / handoff≠execute / accounting boundary / certificate checksum invariants

## Carry gaps (explicit blockers)

- Customer evidence portal → `CUSTOMER_PORTAL_NOT_CONFIGURED`
- Training execution engine → Phase 18
- Data migration engine → `NOT_AVAILABLE` typed
- MRA EIS fiscal / credential store → boundary only
- Payment provider / e-sign → `NOT_CONFIGURED` (Phase 16 carry)
- Prisma EPERM on Windows generate/push → SQL fallback (`scripts/sql/cs-onboarding-phase17-wave4.sql`)
- Rich UI polish beyond thin AdminShell hubs → product waves
- AI-generated plans / ML health → out of scope

## Honesty gates to preserve

- Gate fail → `UNAVAILABLE` with `value: null` — never false zero
- Training COMPLETED only from Training-domain source
- Migration COMPLETED requires reconciliation
- Go-live success → STABILISATION, not onboarding COMPLETED
- Progress % ≠ completion; certificate checksum idempotent
- No Tenant GL / OB / journals / stock from onboarding
- No credentials in exports / search / general documents
