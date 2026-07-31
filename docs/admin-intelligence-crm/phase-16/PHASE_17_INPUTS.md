# Phase 17 Inputs — from Closed-Won Conversion Phase 16

**Source exit:** `READY_FOR_PHASE_17_WITH_BLOCKERS` (see `FINAL_PHASE_16_REPORT.md`)  
**Date:** 2026-07-31

## What Phase 17 may consume

| Input | Location / contract | Notes |
|-------|---------------------|-------|
| CrmConversionRequest / CrmConversion spine | `lib/admin/crm/conversions/*` | CVR + CVN durable saga; early Closed Won lock |
| Phase 15 acceptance + Closed-Won handoff | commercial `acceptance.js` / `phase16Handoff.js` | Evidence consumed; never deleted by compensation |
| Customer match / create-link decisions | `customerMatch.js`, `customerProvision.js` | No auto-merge |
| Tenant / Business / Branch provision | `tenantProvision.js`, `businessBranch.js` | Isolation asserted; no Tenant GL |
| Hash-only invitations | `invitations.js` | No temporary passwords |
| Subscription / entitlements from accepted snapshot | `subscription.js`, `entitlements.js` | Qty ≤ accepted; Closed Won ≠ ACTIVE |
| Platform billing / invoice / payment boundary | `billing.js`, `paymentBoundary.js` | Initiation ≠ PAID; NOT_CONFIGURED typed |
| Activation policy evaluation | `activation.js` | AFTER_PAYMENT requires authoritative payment truth |
| CS assignment | `customerSuccess.js` `assignCustomerSuccessOwner` | Ownership only; no fabricated health |
| Onboarding / training / migration / MRA handoffs | `*Handoff.js` | Idempotent; executionStatus NOT_STARTED |
| Completion certificate | `completion.js` `finalizeConversion` | Stable checksum; ≠ PAID/ACTIVE/onboarding complete |
| Conversion reports + DQ + recon | `reports.js`, `dataQuality.js`, `reconciliation.js` | EMPTY/UNAVAILABLE on gate fail |
| Weighted Pipeline UI accessor | `opportunities/commercial.js` `resolveWeightedPipelineUiAccess` | Honesty + currency; indicative ≠ Revenue |

## What Phase 17 must not assume

- Payment provider is configured or invoices are PAID
- E-sign provider is configured or signatures exist
- Onboarding / training / migration / MRA EIS already executed from handoff emission
- Acceptance already deleted or invalidated by compensation
- Silent multi-currency weighted totals exist without currency gate
- Owner/team/territory scope filtering is fully implemented
- Rich conversion UI hubs beyond thin stubs
- Fabricated conversion volume KPIs when reliability gate fails

## Suggested Phase 17 scope seeds

1. **Consume domain handoffs** into real onboarding / training / migration / MRA setup planes (still no fabricate complete)
2. Optional: wire payment provider callback → authoritative PAID → re-activation under AFTER_PAYMENT
3. Optional: e-sign provider integration without fabricating interim signatures
4. Harden owner/team/territory scope filtering across conversion + Opportunity lists
5. Deepen conversion report centre + exports under privacy projections
6. Keep invent-zeroes / currency-separation / handoff≠execute / acceptance preservation invariants

## Carry gaps (from Phase 16 + earlier)

- Payment provider → `NOT_CONFIGURED` when missing
- E-sign provider → `NOT_CONFIGURED`
- Full onboarding / training / migration / MRA fiscal execution → later
- Scope filtering stub → harden in ops waves
- Telephony + Call recording → later / provider wave
- Google/Outlook sync → later / provider wave
- Email/WhatsApp Lead ingest → later
- Demo recording media + cloud Demo infra → later
- Prisma EPERM on Windows generate/push → SQL fallback available
- Rich conversion UI hubs → product polish waves
- AI provisioning / auto-merge → out of foundation scope

## Honesty gates to preserve

- Empty conversion report ≠ invent zeroes
- Gate fail → UNAVAILABLE with `value: null` — never false zero
- Handoff ≠ execute; never fabricate onboarding/training complete
- No MRA fiscal / credentials from conversion plane
- Payment initiation ≠ PAID; Closed Won ≠ ACTIVE
- Compensation never deletes acceptance / paid evidence
- Weighted UI unlock requires honesty + currency — indicative ≠ Revenue
- Tenant Quotation remains WRONG_DOMAIN
