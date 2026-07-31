# Phase 15 Input Validation

**Validated:** 2026-07-31  
**Upstream exit:** `READY_FOR_PHASE_15_WITH_BLOCKERS` (Phase 14 `FINAL_PHASE_14_REPORT.md` / `FINAL_READINESS_DECISION.md`)

## Sources checked

| Source | Path | Result |
|--------|------|--------|
| Phase 15 inputs | `docs/admin-intelligence-crm/phase-14/PHASE_15_INPUTS.md` | PRESENT — Demo handoffs, Opp proposalReadiness, Activity/Email/eligibility listed |
| Readiness checklist | `docs/admin-intelligence-crm/phase-14/PHASE_15_READINESS_CHECKLIST.md` | PRESENT — must-be-true Demo plane checked; Proposal create listed as carry blocker |
| Final Phase 14 report | `docs/admin-intelligence-crm/phase-14/FINAL_PHASE_14_REPORT.md` | PRESENT — exit `READY_FOR_PHASE_15_WITH_BLOCKERS` |
| Design | `docs/superpowers/specs/2026-07-31-commercial-documents-phase-15-design.md` | APPROVED 2026-07-31 — Approach 1 + Approach B |
| Plan | `docs/superpowers/plans/2026-07-31-commercial-documents-phase-15.md` | PRESENT — Task 0 = this pack |

## Phase 14 must-be-true (consumed honestly)

| Gate | Evidence class |
|------|----------------|
| CrmDemoRequest / CrmDemo spine | CORRECT_AND_REUSABLE — `lib/admin/crm/demos/*` |
| Proposal handoff payload idempotent; `proposalCreated: false` | CORRECT_AND_REUSABLE — `demos/handoffs.js` `emitDemoProposalHandoff` |
| Trial handoff ≠ create | CORRECT_AND_REUSABLE — orthogonal to commercial docs |
| Demo outcome never auto Opp mutation | CORRECT_AND_REUSABLE boundary |
| Meeting/Calendar / Activity / Email / eligibility | CORRECT_AND_REUSABLE — Phase 13 |
| Recording provider / cloud Demo infra | NOT_AVAILABLE — do not assume |
| Opportunity proposal readiness | CORRECT_AND_REUSABLE — `opportunities/proposalReadiness.js` |
| Conversion readiness handoff | CORRECT_AND_REUSABLE — `opportunities/conversionReadiness.js` |

## Phase 15 reuse plane (pre-Wave-1)

| Asset | Path | Class for Commercial Docs |
|-------|------|---------------------------|
| Demo proposal handoff | `lib/admin/crm/demos/handoffs.js` | CORRECT_AND_REUSABLE — seed Proposal Request; never invent Proposal |
| Opp proposal readiness | `lib/admin/crm/opportunities/proposalReadiness.js` | CORRECT_AND_REUSABLE — checklist + `CRM_PROPOSAL_HANDOFF` payload |
| Opp conversion readiness | `lib/admin/crm/opportunities/conversionReadiness.js` | CORRECT_AND_REUSABLE — Closed-Won eval; Phase 16 consume |
| Opp commercial estimates | `lib/admin/crm/opportunities/commercial.js` | FOUNDATION / CORRECT_AND_REUSABLE — non-binding; FABRICATED_PRICE_RISK if treated as issued quote |
| Opp products | `lib/admin/crm/opportunities/products.js` | FOUNDATION — catalogue codes + free-form `unitAmountEstimate` |
| Account / Contact / consent | Phase 11 libs | CORRECT_AND_REUSABLE |
| Email send / eligibility | Phase 13 `emails/*`, `eligibility.js` | EXTEND — delivery path |
| Product catalogue features/modules | `lib/admin/productCatalogue/*` | FOUNDATION — identity only; no prices |
| PlatformPlanVersion | `prisma` `PlatformPlanVersion` | REUSE_WITH_RECONCILIATION — platform billing; not CRM Price Book |
| `subscriptionConfig.js` hardcoded prices | `lib/subscriptionConfig.js` | WRONG_SOURCE for issued CRM quotes |
| Tenant Quotation | `prisma` `Quotation*`, `app/quotations`, `app/api/quotations/**` | WRONG_DOMAIN |
| Rentals Quotation | `lib/rentalV2/quotationService.js` | WRONG_DOMAIN |
| Tenant tax / currencyService silent FX=1 | `lib/taxCalculationService.js`, `lib/currencyService.js` | WRONG_DOMAIN / CURRENCY_RISK / FORBIDDEN as silent CRM FX |
| Tenant quotation PDF | `lib/server-pdf.js` `generateQuotationPdf` | WRONG_DOMAIN / REUSE_WITH_RECONCILIATION for render stack only |
| CrmProposal / CrmCommercialDocument / CRM Price Books | — | NOT_FOUND |
| CRM commercial hub UI | `/insightbooks/crm/proposals` etc. | NOT_FOUND |
| `resolveCrmScope` | `lib/admin/crm/authz.js` | FOUNDATION / CROSS_TENANT_RISK — stub `mode: 'all'` |

## Identity / consent blockers?

**None** that block Wave 1 Proposal Request + commercial document spine. Account/Contact/consent/eligibility exist and fail-closed on UNKNOWN for outbound. E-sign remains NOT_CONFIGURED (Wave 3 boundary). Tenant Quotation must not be aliased.

## Validation verdict

**PASS** — Phase 14 exit is honest; design/plan locked; reuse plane identified (Demo/Opp handoffs CORRECT_AND_REUSABLE; tenant Quotation WRONG_DOMAIN; CrmProposal NOT_FOUND; Price Books NOT_FOUND). Proceed to Wave 0 readiness decision (**CONDITIONAL GO** expected).
