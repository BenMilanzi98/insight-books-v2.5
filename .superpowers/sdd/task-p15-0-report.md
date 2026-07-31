# Task P15-0 Report — Wave 0 Forensic Audits + Matrices

**Task:** Wave 0 — Forensic audits + matrices + readiness (Phase 15 Commercial Documents)  
**Date:** 2026-07-31  
**Workspace:** `c:\laragon\www\insight-books-v2.5` (WORKING_TREE; Phases 7–14 dirty — not reset)  
**Status:** **DONE**

## Summary

Completed Phase 15 Wave 0 docs-only pack under `docs/admin-intelligence-crm/phase-15/` (54/54 required files). Phase input validation **PASS**. Final readiness: **CONDITIONAL GO** for Wave 1. No application code, Prisma, APIs, UI, or SQL written. No git commit.

## Inputs validated

| Source | Result |
|--------|--------|
| `docs/admin-intelligence-crm/phase-14/PHASE_15_INPUTS.md` | PRESENT — Demo handoffs, Opp proposalReadiness |
| `docs/admin-intelligence-crm/phase-14/PHASE_15_READINESS_CHECKLIST.md` | PRESENT — Proposal create listed as carry blocker |
| `docs/admin-intelligence-crm/phase-14/FINAL_PHASE_14_REPORT.md` | PRESENT — exit `READY_FOR_PHASE_15_WITH_BLOCKERS` |
| Design `2026-07-31-commercial-documents-phase-15-design.md` | APPROVED — Approach 1 + Approach B |
| Plan `2026-07-31-commercial-documents-phase-15.md` | PRESENT — Task 0 = this pack |

## Key forensic findings (verbatim classifications)

| Asset | Classification | Evidence |
|-------|----------------|----------|
| CrmProposal / CrmCommercialDocument / CRM Price Books | **NOT_FOUND** | No Prisma models; no `lib/admin/crm/commercial/*`; no `/insightbooks/crm/proposals` |
| Tenant Quotation (`Quotation*`, `app/quotations`, `app/api/quotations/**`) | **WRONG_DOMAIN** | SME AR plane — must not alias as CRM commercial truth |
| Rentals Quotation | **WRONG_DOMAIN** | `lib/rentalV2/quotationService.js` |
| Demo `emitDemoProposalHandoff` | **CORRECT_AND_REUSABLE** | `lib/admin/crm/demos/handoffs.js` — idempotent; `proposalCreated: false`; rejects create flags |
| Opp `evaluateProposalReadiness` | **CORRECT_AND_REUSABLE** | `lib/admin/crm/opportunities/proposalReadiness.js` — handoff payload only |
| Opp `evaluateConversionReadiness` | **CORRECT_AND_REUSABLE** | `conversionReadiness.js` — Phase 16 consume; never provisions |
| Opp commercial estimates / products | **FOUNDATION** / **CORRECT_AND_REUSABLE** | Non-binding; **FABRICATED_PRICE_RISK** if treated as issued quote |
| PlatformPlanVersion | **REUSE_WITH_RECONCILIATION** | Platform billing — pin via Price Book later |
| `subscriptionConfig.js` hardcoded prices | **WRONG_SOURCE** | Storefront defaults |
| Tenant `currencyService` (missing rate → 1.0) | **CURRENCY_RISK** / **FORBIDDEN** for CRM FX | Do not silent-convert |
| Tenant tax engines / QuotationItemTax | **WRONG_DOMAIN** / **TAX_RISK** | No CRM commercial tax today (**NOT_FOUND**) |
| Commercial approval / discount / exception engines | **NOT_FOUND** | Close/probability stubs ≠ commercial approval (**APPROVAL_BYPASS_RISK** if assumed) |
| PDF / storage / delivery / review / acceptance / e-sign | **NOT_FOUND** | Tenant PDF/send = WRONG_DOMAIN; e-sign **NOT_CONFIGURED** |
| `resolveCrmScope` stub `mode: 'all'` | **FOUNDATION** / **CROSS_TENANT_RISK** | Carry — same as P12–14 |

## Locked design reflected

- Approach 1: `CrmCommercialDocument` spine; Proposal/Quotation typed extensions  
- Real deterministic PDF renderer (Wave 3); e-sign NOT_CONFIGURED  
- New CRM Price Books; in-platform tax + explicit FX snapshots  
- Approach B waves; Tenant Quotation = WRONG_DOMAIN; acceptance ≠ Closed Won; handoff ≠ create  

## Deliverables

All files under `docs/admin-intelligence-crm/phase-15/`:

- README, PHASE_15_SCOPE, PHASE_INPUT_VALIDATION  
- 27× CURRENT_* audits + 5× COMMERCIAL_* (DQ/recon/privacy/security/performance)  
- 16× matrices (source, domains, pricing, FX, tax, discount, exception, approval, terms, template, delivery, acceptance, reliability, security)  
- PHASE_15_GAP_REGISTER (G15-01…30 → Waves 1–4)  
- IMPLEMENTATION_PLAN (pointer to authoritative plan)  
- FINAL_READINESS_DECISION → **CONDITIONAL GO**

## Acceptance checklist

- [x] All listed docs exist with real findings (paths, classifications)  
- [x] Phase input validation recorded  
- [x] Gap register + IMPLEMENTATION_PLAN maps gaps → Waves 1–4  
- [x] FINAL_READINESS_DECISION records **CONDITIONAL GO** with reasons  
- [x] No application code written  
- [x] No git commit  

## Decision

**CONDITIONAL GO** for Wave 1 — no true BLOCKED dependency. Stop until user chooses Subagent-Driven or Inline execution for Wave 1.

## Concerns

None blocking. Carry notes (not Wave 1 hard blocks): e-sign NOT_CONFIGURED; `resolveCrmScope` stub; Prisma EPERM SQL fallbacks; orthogonal Demo cloud/recording/telephony/calendar/ingest; do not alias tenant Quotation or invent prices from Opp estimates.

## Commits

None (per instructions).
`
