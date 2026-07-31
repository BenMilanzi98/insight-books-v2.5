# Phase 15 Final Report — Commercial Documents

**Decision:** **READY_FOR_PHASE_16_WITH_BLOCKERS**

**Date:** 2026-07-31

**Working tree:** Phase 15 Waves 0–4 delivered in-place on branch `v2` (no git commit required for Wave 4 exit). Phases 7–14 remain in the same working tree.

Commercial Documents ship first-class **CrmProposalRequest** (`PRQ-YYYY-######`) and **CrmCommercialDocument** (Proposal/Quotation families with versioned content), Price Book–backed pricing with explicit FX/tax/discounts/exceptions/approvals, deterministic PDF artifacts with checksums, secure customer delivery/review, source-backed acceptance/rejection (e-sign **NOT_CONFIGURED**), commercial hubs + honesty-gated reporting/DQ/recon, Closed-Won readiness evaluation, and Phase 16 conversion handoff payloads only. Tenant Quotation / rentals quotations / platform billing KPIs remain **WRONG_DOMAIN**. Acceptance never auto-mutates Opportunity stage/probability/close date and never provisions Customer/Tenant/Subscription/Invoice.

## Delivered

| Wave | Focus | Status |
|------|-------|--------|
| 0 | Forensic audits + matrices + CONDITIONAL GO | Done |
| 1 | Proposal Request + CrmCommercialDocument spine; Demo/Opp convert idempotency; numbering/versioning/status | Done |
| 2 | Price Books + product/line items + pricing/tax/FX + discounts/exceptions + terms/clauses + approval SoD | Done |
| 3 | Templates/branding + PDF/checksum/storage + issue/delivery/review + acceptance/rejection + expiry + e-sign boundary NOT_CONFIGURED | Done |
| 4 | Commercial hubs + reports/schedules + DQ/recon + Closed-Won readiness + Phase 16 handoff pack + Opp extensions | Done |

## Surfaces (Wave 4)

### Libraries

- `lib/admin/crm/commercial/readiness.js` — `evaluateClosedWonReadiness` → `NOT_READY|PARTIALLY_READY|READY|BLOCKED|HANDED_OFF`
- `lib/admin/crm/commercial/phase16Handoff.js` — `createClosedWonConversionHandoff` payload only; never provisions
- `lib/admin/crm/commercial/reliabilityGate.js` + `metrics.js` + `reports.js` — honesty-gated KPIs; currency-separated overview
- `lib/admin/crm/commercial/reportSchedules.js` — audited create/list/run
- `lib/admin/crm/commercial/dataQuality.js` + `reconciliation.js` — gate fail ≠ fabricated zero
- `lib/admin/crm/commercial/hubKeys.js` — routes / permission notes / search keys / cache prefixes
- Opp `conversionReadiness.js` — soft commercial acceptance + Phase 16 handoff checklist (no auto stage)

### Prisma / SQL

- `CrmClosedWonConversionHandoff`, `CrmCommercialReportSchedule`, `CrmCommercialReportRun`
- `CrmCommercialDqIncident`, `CrmCommercialReconRun`
- Fallback: `scripts/sql/crm-commercial-phase15-wave4.sql`

### UI

- Thin stubs: `/insightbooks/crm/commercial/overview|my-work|expiring|responses`
- `/insightbooks/crm/commercial-approvals`, `/insightbooks/crm/commercial-reports`

## Hard rules preserved

- Tenant Quotation / `app/quotations` = WRONG_DOMAIN — never aliased as CRM commercial truth
- Acceptance ≠ Closed Won ≠ Contract ≠ Subscription ≠ Tenant provision
- Phase 16 handoff creates nothing (Customer/Tenant/Subscription/Invoice/Payment)
- Never auto-mutate Opportunity stage / probability / close date
- Metric/report gate fail → EMPTY/UNAVAILABLE — never fabricated zeroes
- Currency-separated overview — no silent ZAR+USD sum
- E-sign provider **NOT_CONFIGURED** — never fabricate signatures
- Weighted Pipeline UI remains dark (Phase 16)

## Verification

```bash
npx vitest run \
  test/systemAdmin.crm.commercialWave4.test.js \
  test/systemAdmin.crm.commercialWave3.test.js \
  test/systemAdmin.crm.commercialWave2.test.js \
  test/systemAdmin.crm.commercialWave1.test.js
```

**Result (2026-07-31):** Wave 4 suite — Test Files 1 passed · Tests 7 passed (RED→GREEN recorded in task report). Prior Waves 1–3 remain in working tree.

## Known blockers for Phase 16

1. **E-sign provider** — `NOT_CONFIGURED` (governance boundary only; never fabricate)
2. **Production Tenant / Subscription / Invoice / Payment** — handoff payloads only; conversion remains human-gated
3. **Weighted Pipeline UI / reports** — deferred to Phase 16 (still dark)
4. **Owner / team / territory list scope filtering** — `resolveCrmScope` still `mode: 'all'` stub
5. **Telephony / Call recording** — `NOT_AVAILABLE` (carry)
6. **Google / Outlook calendar sync** — `NOT_CONNECTED` (carry)
7. **Email / WhatsApp → Lead ingest** — `NOT_AVAILABLE` (carry)
8. **Demo recording media + real cloud Demo infra** — `NOT_AVAILABLE` (carry from Phase 14)
9. **Prisma generate / db push on Windows** — schema + SQL ready; apply when EPERM clears
10. **Rich UI hubs** — many commercial surfaces remain thin stubs; APIs/services are live
11. **AI commercial copy / auto-negotiate** — forbidden; not started

## Exit readiness

**READY_FOR_PHASE_16_WITH_BLOCKERS** — Phase 15 Waves 1–4 deliver a trustworthy commercial plane including Price Books, issued immutability, acceptance evidence, honesty-gated reporting, Closed-Won readiness, and Phase 16 conversion handoff payloads; e-sign, Tenant provision, weighted UI, and rich hubs remain explicit carry blockers.
