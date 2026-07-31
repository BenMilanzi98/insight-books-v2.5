# Phase 21 Inputs — from Lead Conversion / Closed-Won Phase 20

**Source exit:** `READY_FOR_PHASE_21_WITH_BLOCKERS` (see `FINAL_PHASE_20_REPORT.md`)  
**Date:** 2026-07-31

## Authoritative handoff contract

Phase 21 consumes the **canonical onboarding handoff** emitted by conversion (`createOnboardingHandoff` / `sendOnboardingHandoff` in `lib/admin/crm/conversions/onboardingHandoff.js`):

| Field group | Contract notes |
|-------------|----------------|
| Identity | Conversion id / number, acceptance id, opportunity id, customer / tenant pins when provisioned |
| Commercial snapshot | Immutable checksummed accepted snapshot — never mutate from Phase 21 |
| Contacts / scopes | Linked contacts + ownership; no auto-merge |
| Ownership / dates / success criteria | CS owner assignment when present; planned dates; criteria as recorded |
| Reliability checksum | `computeOnboardingHandoffChecksum` — verify before execute |
| Package status | Pending-provisioning labels honest; handoff ≠ Project execution |

**CS tree-17** (`docs/admin-intelligence-crm/phase-17/`, `lib/admin/customerSuccess/onboarding/**`) is the **FUTURE consumer** of this handoff under PRD Phase 21. Phase 20 does **not** create Onboarding Projects.

**Mislabel map pointer:** see `MISLABELLED_PHASE_ARTIFACT_AUDIT.md` and `PHASE_CONTENT_COMPATIBILITY_MAP.md` — tree phase-16 = PRD 20 conversion; tree phase-17 = FUTURE PRD 21 onboarding (quarantined, not deleted).

**Non-authoritative:** Adoption `phase-19/PHASE_20_INPUTS.md` describes CS renewals — do **not** treat as conversion → Phase 21 inputs.

## What Phase 21 may consume

| Input | Location / contract | Notes |
|-------|---------------------|-------|
| CrmConversionRequest / CrmConversion spine | `lib/admin/crm/conversions/*` | CVR + CVN durable saga; Closed Won early lock |
| Acceptance + Closed-Won readiness | commercial readiness + conversion readiness | UNKNOWN ≠ READY |
| Commercial snapshot | `commercialSnapshot.js` | Immutable + checksum |
| Customer / Contact duplicate gates | `customerMatch.js`, `businessBranch.js` | No auto-merge |
| Provision / entitlement / activation **requests** | Wave 3 honesty | Never fabricate ACTIVATED/PROVISIONED/PAID |
| Onboarding handoff (one active + supersession) | `onboardingHandoff.js` | Handoff ≠ execute |
| Completion certificate | `completion.js` | Stable checksum; ≠ PAID/ACTIVE/onboarding complete |
| Metrics / reliability / DQ / recon / exports / search | Wave 4 modules | Gate fail → UNAVAILABLE / `value: null`; scope fail-closed |
| Value labels | `valueLabels.js` | Accepted / Closed-Won ≠ collected/recognised Revenue |
| EN + NY hub keys | `locales/*/admin-pages.json` `crm.conversionHub.*` | Smoke-covered |

## What Phase 21 must not assume

- Onboarding Project already exists from Phase 20 emission
- Payment provider / e-sign configured or invoices PAID
- ACTIVATED / PROVISIONED / ACTIVE without authoritative provider result
- Reliability gate failures may be rendered as zero KPIs
- `lineageIntact: true` without instrumented lineage
- Accepted / Closed-Won value is collected or recognised Revenue
- Adoption renewals inputs authorise conversion scope
- Rich scheduled-report polish / full Closed-Won UI surface beyond thin aliases

## Suggested Phase 21 scope seeds

1. Consume onboarding handoff into CS Onboarding Project execution (tree-17 / PRD 21) without inventing completion
2. Verify handoff checksum + pending-provisioning labels before execute
3. Optional: wire payment/e-sign callbacks → authoritative truth → re-activation
4. Keep invent-zeroes / handoff≠execute / accounting boundary / mislabel quarantine invariants

## Carry gaps (explicit blockers)

- Payment provider → `NOT_CONFIGURED`
- E-sign provider → `NOT_CONFIGURED`
- Full onboarding / training / migration / MRA fiscal **execution** → Phase 21+ / later planes
- Rich scheduled-report polish beyond honesty-gated foundations
- Full `/closed-won/*` UI surface if only thin aliases shipped
- Prisma EPERM on Windows generate/push → SQL fallback (`hasCrm*Model`)
- Owner/team/territory membership resolution beyond explicit scope args (ops data)

## Honesty gates to preserve

- Gate fail → `UNAVAILABLE` with `value: null` — never false zero
- Never invent `lineageIntact: true`
- Handoff ≠ Onboarding Project execution
- No Tenant GL / MRA fiscal from conversion plane
- Accepted / Closed-Won value ≠ collected / recognised Revenue
- Sales-team / territory / customer / tenant search/export/DQ/metrics fail-closed
