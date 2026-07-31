# Phase 22 Inputs — from Customer Onboarding Phase 21

**Source exit:** `READY_FOR_PHASE_22_WITH_BLOCKERS` (see `FINAL_PHASE_21_REPORT.md`)  
**Date:** 2026-07-31

## Authoritative handoff contract

Phase 22 consumes the **canonical Phase 22 Training handoff** emitted by onboarding (`emitPhase22TrainingHandoff` / checksum helpers in `lib/admin/customerSuccess/onboarding/training.js`):

| Field group | Contract notes |
|-------------|----------------|
| Identity | Onboarding Project id / number, tenant / customer pins, commercial snapshot refs |
| Training requirements | Products/modules/roles/participants/contacts/dates/objectives as recorded |
| Reliability checksum | `computePhase22TrainingHandoffChecksum` — verify before Training Program create |
| Package status | Handoff ≠ Training Program / Session / attendance / certificate delivery |

**Mislabel map pointer:** see `MISLABELLED_ONBOARDING_ARTIFACT_AUDIT.md` and `ONBOARDING_COMPATIBILITY_MAP.md` — **tree phase-18 Training = FUTURE PRD 22**. Do not claim Adoption Phase 20. Tree phase-19 Adoption remains FUTURE / quarantined and must not redefine onboarding or Training. Completion ≠ adoption.

**Non-authoritative:** Adoption `phase-19/PHASE_20_INPUTS.md` (CS renewals) and tree `phase-17/PHASE_18_INPUTS.md` numbering — do **not** treat as PRD 22 Training inputs.

## What Phase 22 may consume

| Input | Location / contract | Notes |
|-------|---------------------|-------|
| CustomerOnboardingRequest / Project spine | `lib/admin/customerSuccess/onboarding/*` | ONR + ONB durable; handoff ≠ request ≠ project |
| Phase 20 → 21 onboarding handoff consume | `handoffConsume.js` | Idempotent accept; checksum validate |
| Phase 22 Training handoff package | `training.js` (`emitPhase22TrainingHandoff`) | Checksum + idempotent; never creates Programs/Sessions |
| Training coordination row | `training.js` | Coordination COMPLETED still requires Training-domain source |
| Go-live → stabilisation → completion / CS handover | `goLive.js`, `stabilisation.js`, `completion.js`, `handover.js` | Go-live ≠ completion; completion ≠ adoption |
| Completion certificate | `completion.js` | Checksum stable; progress ≠ completion |
| Health / progress / metrics | `health.js`, `progress.js`, `metrics.js` | Gate fail → UNAVAILABLE / `value: null` |
| DQ / recon / lineage | `dataQuality.js`, `reconciliation.js`, `lineage.js` | Never invent zeroes / `lineageIntact: true` |
| Reports / exports / search | `reports.js`, `exports.js`, `search.js` | Credentials stripped; portfolio fail-closed |
| Status honesty labels | `honestyLabels.js` | Progress ≠ readiness ≠ completion; completion ≠ adoption |
| EN + NY hub keys | `locales/*/admin-pages.json` `customerSuccess.onboardingHub.*` | Smoke-covered |

## What Phase 22 must not assume

- Training Programs / Sessions / attendance / certificates already exist from Phase 21 handoff emission
- Onboarding completion implies Training delivery or adoption
- Progress % or readiness READY implies onboarding COMPLETED
- Customer evidence portal is configured (`CUSTOMER_PORTAL_NOT_CONFIGURED`)
- Full data-migration engine / MRA EIS fiscal submission authorised from onboarding
- Payment / e-sign providers configured (Phase 20 carry)
- Reliability gate failures may be rendered as zero KPIs
- `lineageIntact: true` without instrumented lineage
- Tree-18 / Adoption packs authorise PRD 21 onboarding scope or delete CS folders

## Suggested Phase 22 scope seeds

1. Consume Phase 22 Training handoff into Training Programs / curricula / cohorts / sessions without inventing delivery from empty foundations
2. Verify handoff checksum + idempotency before Program create
3. Declare DELIVERED / COMPLETED / PASSED / CERTIFIED only from Training-domain evidence
4. Keep invent-zeroes / handoff≠execute / accounting boundary / certificate checksum invariants
5. Do not absorb or delete Adoption tree-19; do not claim Adoption Phase 20

## Carry gaps (explicit blockers)

- Customer evidence portal → `CUSTOMER_PORTAL_NOT_CONFIGURED`
- Training delivery engine (Programs/Sessions/certs) → **PRD Phase 22** (tree-18 FUTURE)
- Data migration engine → `NOT_AVAILABLE` typed
- MRA EIS fiscal / credential store → boundary only
- Payment provider / e-sign → `NOT_CONFIGURED` (Phase 20 carry)
- Prisma EPERM on Windows generate/push → SQL fallback (`scripts/sql/cs-onboarding-phase17-wave4.sql`)
- Rich UI polish / scheduled-report polish beyond thin AdminShell hubs
- Full lineage instrumentation (`lineageIntact` remains UNAVAILABLE until instrumented)
- AI-generated plans / ML health → out of scope

## Honesty gates to preserve

- Gate fail → `UNAVAILABLE` with `value: null` — never false zero
- Never invent `lineageIntact: true`
- Progress ≠ readiness ≠ completion; completion ≠ adoption
- Training COMPLETED only from Training-domain source (Phase 22)
- Go-live success → STABILISATION path, not automatic onboarding COMPLETED alone
- Handoff ≠ Training Program execution
- No Tenant GL / OB / journals / stock from onboarding
- No credentials in exports / search / general documents
- Do not delete mislabelled CS folders (tree-17/18/19)
