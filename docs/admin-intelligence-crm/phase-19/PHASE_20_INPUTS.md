# Phase 20 Inputs — from Customer Adoption Phase 19

**Source exit:** `READY_FOR_PHASE_20_WITH_BLOCKERS` (see `FINAL_PHASE_19_REPORT.md`)  
**Date:** 2026-07-31

## What Phase 20 may consume

| Input | Location / contract | Notes |
|-------|---------------------|-------|
| CustomerAdoptionRequest / Plan spine | `lib/admin/customerSuccess/adoption/*` | ADR + ADP durable; Training COMPLETED consume; handover attach ≠ invent COMPLETED |
| Milestones / value outcomes / Plan completion | Wave 2 services | Phase 9 evidence honesty; COMPLETED gated by evaluation |
| Champions / dormancy / Phase 8 intervention links | Wave 3 | Contact-verified champions; dormancy RECOVERED evidence gate; link-by-id only |
| Expansion handoffs | `expansion.js` | DRAFT→HANDED_OFF→ACKNOWLEDGED; no Subscription/entitlement/invoice writes |
| Health / metrics / reliability | `health.js`, `metrics.js`, `reliabilityGate.js` | Gate fail → UNAVAILABLE / `value: null` |
| DQ / recon / lineage | `dataQuality.js`, `reconciliation.js`, `lineage.js` | Never invent zeroes / `lineageIntact: true` |
| Reports / exports / search | `reports.js`, `exports.js`, `search.js` | Secrets/tokens stripped; portfolio fail-closed |
| Phase 8 Success Plan link | `phase8Migrate.js`, `foundations.js` | Plan when linked; UNKNOWN if unresolved / broken |
| EN + NY hub keys | `locales/*/admin-pages.json` `customerSuccess.adoptionHub.*` | Smoke-covered |

## What Phase 20 must not assume

- Expansion ACK implies renewals/billing/entitlement execute
- Reliability gate failures may be rendered as zero KPIs
- Phase 8 historical `CsSuccessPlan.status=COMPLETED` implies Adoption Plan COMPLETED
- Training COMPLETED / onboarding handover alone implies Plan COMPLETED
- Advanced ML churn scoring / rich customer self-serve adoption portal are delivered
- Virtual provider / session recording / rich LMS banks / training portal / payment/e-sign are configured (Phase 18 carry)

## Suggested Phase 20 scope seeds

1. Deepen renewals execute-after-ACK consuming Expansion handoffs honestly
2. Optional: expansion quoting / commercial package attachment (typed until wired)
3. Optional: advanced health / churn scoring when instrumented (never invent scores)
4. Optional: customer self-serve adoption portal evidence path (typed unavailable until then)
5. Keep invent-zeroes / handoff≠execute / accounting boundary / Phase 8 UNKNOWN invariants

## Carry gaps (explicit blockers)

### From Phase 18
- Virtual provider → `VIRTUAL_PROVIDER_NOT_CONFIGURED`
- Session recording → not delivered
- Rich LMS authoring / question banks → optional gap
- Customer training portal → typed unavailable if referenced
- Payment provider / e-sign → `NOT_CONFIGURED` (Phase 16 carry)

### From Phase 19 (optional / out of thin Wave 4)
- Advanced ML churn scoring → out of scope / typed unavailable
- Rich customer self-serve adoption portal → typed unavailable if referenced
- Deep renewals execute integration beyond handoff ACK → Phase 20+
- Prisma EPERM on Windows generate/push → SQL fallback (`scripts/sql/cs-adoption-phase19-wave4.sql`)
- Rich UI polish beyond thin AdminShell hubs → product waves

## Honesty gates to preserve

- Gate fail → `UNAVAILABLE` with `value: null` — never false zero
- Plan COMPLETED only from Adoption evaluation policy + manage/portfolio authz
- Phase 8 Success Plan link or UNKNOWN — never invent Plan COMPLETED from legacy rows
- Expansion handoff ≠ execute billing / entitlements / Tenant GL
- No secrets / tokens in search / exports
- Portfolio list/search/export/DQ/metrics/writes fail-closed
