# Phase 16 Inputs — from Commercial Documents Phase 15

**Source exit:** `READY_FOR_PHASE_16_WITH_BLOCKERS` (see `FINAL_PHASE_15_REPORT.md`)  
**Date:** 2026-07-31

## What Phase 16 may consume

| Input | Location / contract | Notes |
|-------|---------------------|-------|
| CrmProposalRequest / CrmCommercialDocument spine | `lib/admin/crm/commercial/*` | PRQ + Proposal/Quotation families; Tenant Quotation = WRONG_DOMAIN |
| Price Books + pricing snapshot | `priceBooks.js`, `pricing.js`, `pricingSnapshot.js` | Explicit FX; no silent rate=1 |
| Issued artifacts + checksums | `artifacts.js`, `checksum.js`, `render.js` | Append-only; customer-safe projections |
| Acceptance evidence | `acceptance.js` | Version + checksum + authority; ≠ Closed Won |
| Closed-Won readiness | `readiness.js` `evaluateClosedWonReadiness` | READY when evidence complete; HANDED_OFF after emit |
| Phase 16 conversion handoff | `phase16Handoff.js` `createClosedWonConversionHandoff` | Idempotent payload; `customerCreated/tenantCreated/…: false` |
| Commercial reports + schedules | `reports.js`, `reportSchedules.js` | EMPTY/UNAVAILABLE on gate fail; currency-separated |
| DQ + recon runners | `dataQuality.js`, `reconciliation.js` | Never invent zeroes |
| Opp conversion readiness (extended) | `opportunities/conversionReadiness.js` | Soft commercial acceptance + handoff checklist |
| Demo proposal handoff (prior) | `demos/handoffs.js` | Still payload → PRQ; orthogonal to Closed-Won handoff |
| E-sign status | `signatureBoundary.js` | Explicitly `NOT_CONFIGURED` |

## What Phase 16 must not assume

- E-sign provider is configured or signatures exist
- Customer / Tenant / Subscription / Invoice already created from Closed-Won or acceptance
- Acceptance already moved Opportunity to Closed Won / changed probability / close date
- Silent multi-currency commercial KPI totals exist
- Weighted Pipeline UI/report totals are enabled (Phase 16 may own enabling them)
- Owner/team/territory scope filtering is fully implemented
- Rich commercial UI hubs beyond thin stubs
- Demo recording media / cloud Demo infra available

## Suggested Phase 16 scope seeds

1. **Human-gated conversion transaction** consuming READY/HANDED_OFF Closed-Won handoff (SoD; never silent)
2. Optional: enable weighted Pipeline UI with honesty gates (currency + reliability)
3. Optional: Tenant / Subscription / Invoice create from approved conversion (never from acceptance alone)
4. Harden owner/team/territory scope filtering across commercial + Opportunity lists
5. Optional: e-sign provider integration without fabricating interim signatures
6. Deepen commercial report centre + exports under privacy projections
7. Keep invent-zeroes / currency-separation / acceptance≠Closed-Won invariants

## Carry gaps (from Phase 15 + earlier)

- E-sign provider → `NOT_CONFIGURED`
- Tenant / Subscription / Invoice / Payment provision → human-gated conversion later
- Weighted Pipeline UI → Phase 16
- Scope filtering stub → harden in ops waves
- Telephony + Call recording → later / provider wave
- Google/Outlook sync → later / provider wave
- Email/WhatsApp Lead ingest → later
- Demo recording media + cloud Demo infra → later
- Prisma EPERM on Windows generate/push → SQL fallback available
- Rich commercial UI hubs → product polish waves
- AI commercial automation → out of foundation scope

## Honesty gates to preserve

- Empty commercial report ≠ invent zeroes
- Gate fail → UNAVAILABLE with `value: null` — never false zero
- Currency-separated overview — no silent ZAR+USD sum
- Acceptance ≠ Closed Won; never auto Opportunity mutation
- Phase 16 handoff ≠ create Customer/Tenant/Subscription/Invoice
- Closed Won ≠ provision
- E-sign NOT_CONFIGURED — never fabricate signatures
- Tenant Quotation remains WRONG_DOMAIN
