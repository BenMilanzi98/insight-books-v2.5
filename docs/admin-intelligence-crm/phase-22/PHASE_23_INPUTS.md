# Phase 23 Inputs — from Customer Training Phase 22

**Source exit:** `READY_FOR_PHASE_23_WITH_BLOCKERS` (see `FINAL_PHASE_22_REPORT.md`)  
**Date:** 2026-07-31  
**Target:** PRD Phase 23 — Marketing Attribution

## Authoritative consume contract

Phase 23 may consume **stable identity and source-classified Training event context** from the canonical Training domain (`lib/admin/customerSuccess/training/**`, tree phase-18 ≡ PRD 22). It must **not** treat Training attendance, completion, or certificates as acquisition attribution without campaign evidence.

| Field group | Contract notes |
|-------------|----------------|
| Identity | Stable Customer / Tenant / Contact pins from Training Programs, Requests, Participants |
| Training event identities | Program / Session / attendance / completion / certificate ids + numbers (TRN/TRS/cert) |
| Source classification | Request source codes (`PHASE_21_TRAINING_HANDOFF`, etc.); Training ≠ Marketing campaign source |
| Consent / communication-eligibility | Boundaries only — marketing-consent and communication-eligibility must be evaluated in Phase 23 SoT; Training does not authorise outreach |
| Outcome handoffs | CS outcome + PA trained-user context are source-labelled; **not** Product Events, Leads, or acquisition |

**Mislabel map pointer:** see `MISLABELLED_TRAINING_ARTIFACT_AUDIT.md` and `TRAINING_COMPATIBILITY_MAP.md` — **tree phase-18 Training ≡ PRD 22**. Demo (`lib/admin/crm/demos/**`) is **PRD 18 Demo** and is preserved — never map Demo into Training. Training ≠ Marketing attribution. Adoption (tree-19) remains FUTURE / quarantined; completion ≠ adoption. Do not delete mislabelled CS folders.

**Non-authoritative:** Tree `phase-18/PHASE_19_INPUTS.md` (Adoption) and onboarding packs that claim Training delivery — do **not** treat as Phase 23 Marketing Attribution inputs.

## What Phase 23 may consume

| Input | Location / contract | Notes |
|-------|---------------------|-------|
| CustomerTraining Request / Program spine | `lib/admin/customerSuccess/training/*` | TRQ + TRN durable; handoff ≠ request ≠ program |
| Phase 21 → 22 Training handoff consume | `handoffConsume.js` | Idempotent accept; checksum validate |
| CS / PA outcome handoffs | `csOutcomeHandoff.js`, `paOutcomeHandoff.js` | Source-labelled; no auto Healthy / Product Events |
| Participants / attendance / completion / certificates | participants, attendance, completion, certificates modules | Evidence-scoped; Participants ≠ auto Leads |
| Health / progress / metrics | `health.js`, `progress.js`, `metrics.js` | Gate fail → UNAVAILABLE / `value: null` |
| DQ / recon / lineage | `dataQuality.js`, `reconciliation.js`, `lineage.js` | Never invent zeroes / `lineageIntact: true` |
| Reports / exports / search | `reports.js`, `exports.js`, `search.js` | Answers/tokens stripped; portfolio fail-closed |
| Status honesty labels | `honestyLabels.js` | Progress ≠ quality ≠ completion; completion ≠ adoption |
| EN + NY hub keys | `locales/*/admin-pages.json` `customerSuccess.trainingHub.*` | Smoke-covered |

## What Phase 23 must not assume

- Training completion / attendance implies acquisition or campaign attribution
- Participants are auto Leads or marketing audiences
- Marketing-consent or communication-eligibility is granted by Training
- Progress % or quality score implies completion or adoption
- Reliability gate failures may be rendered as zero KPIs
- `lineageIntact: true` without instrumented lineage
- Demo Management (PRD 18) is part of Training or Attribution
- Adoption tree-19 authorises Marketing Attribution scope or deletes CS folders
- Answer keys / broad assessment responses are available via search/export

## Suggested Phase 23 scope seeds

1. Bind Marketing Attribution to stable Customer/Tenant/Contact + Training event identities without inventing campaign linkage
2. Enforce source classification — Training event ≠ acquisition attribution without campaign evidence
3. Honour marketing-consent + communication-eligibility boundaries outside Training SoT
4. Keep invent-zeroes / Participants≠Leads / Training≠acquisition / Demo preserve invariants
5. Do not absorb or delete Training, Demo, onboarding, or Adoption folders

## Carry gaps (explicit blockers)

- Marketing Attribution domain / campaign evidence plane → **PRD Phase 23**
- Customer evidence portal → `CUSTOMER_PORTAL_NOT_CONFIGURED` (Phase 21 carry)
- Payment / e-sign providers → `NOT_CONFIGURED` (Phase 20 carry)
- Data migration engine → `NOT_AVAILABLE` typed
- MRA EIS fiscal / credential store → boundary only
- Virtual meeting provider → `VIRTUAL_PROVIDER_NOT_CONFIGURED`
- Rich UI polish / scheduled-report polish beyond thin AdminShell hubs
- Full lineage instrumentation (`lineageIntact` remains UNAVAILABLE until instrumented)
- Prisma EPERM on Windows generate/push → SQL / `has*Model` fallback
- AI-generated Training truth / biometric attendance / public open LMS → out of scope

## Honesty gates to preserve

- Gate fail → `UNAVAILABLE` with `value: null` — never false zero
- Never invent `lineageIntact: true`
- Progress ≠ quality ≠ completion; completion ≠ adoption
- Training ≠ acquisition attribution without campaign evidence
- Participants ≠ auto Leads; attendance ≠ marketing attribution
- Handoff ≠ Training Program execution; certificate ≠ entitlement ≠ accreditation
- No Tenant GL / OB / journals / stock from Training
- No answer keys / credentials in exports / search
- Do not delete mislabelled CS folders (tree-17/18/19); Demo preserved
