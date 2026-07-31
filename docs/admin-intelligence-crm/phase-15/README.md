# Phase 15 — Commercial Documents

**Surface:** `/insightbooks/crm/proposals`, `/quotations` (CRM), `/commercial/*`, `/price-books`, `/proposal-requests`, customer-commercial-review, commercial-reports

**Architecture:** Approach 1 — `CrmCommercialDocument` shared spine; Proposal/Quotation typed extensions under `lib/admin/crm/commercial/*`

**Design:** `docs/superpowers/specs/2026-07-31-commercial-documents-phase-15-design.md`

**Plan:** `docs/superpowers/plans/2026-07-31-commercial-documents-phase-15.md`

**Handoff in:** `docs/admin-intelligence-crm/phase-14/PHASE_15_INPUTS.md`

**Phase 14 exit:** `READY_FOR_PHASE_15_WITH_BLOCKERS`

**Exit decision:** **READY_FOR_PHASE_16_WITH_BLOCKERS** — see `FINAL_READINESS_DECISION.md`, `FINAL_PHASE_15_REPORT.md`, `PHASE_16_INPUTS.md`

## Wave status

| Wave | Focus | Status |
|------|-------|--------|
| 0 | Forensic audits + matrices + readiness | Complete (2026-07-31) |
| 1 | Proposal request + commercial document spine + Proposal/Quotation + numbering/versioning + Demo/Opp convert | Complete |
| 2 | Price Books + pricing/tax/FX/discounts/exceptions/approvals/terms/clauses | Complete |
| 3 | Templates + PDF/checksum/storage + issue/delivery/review/acceptance + e-sign boundary | Complete |
| 4 | Hubs + reports/DQ/recon + Closed-Won readiness + Phase 16 handoff pack | Complete (2026-07-31) |

## Hard rules

- Proposal ≠ Quotation ≠ Contract ≠ Platform Invoice ≠ Tenant Invoice
- Acceptance ≠ Closed Won ≠ Subscription ≠ Tenant provision
- Quoted MRR/ARR/TCV ≠ contracted MRR/ARR ≠ recognised Revenue
- Tenant Quotation (`app/quotations`, Prisma `Quotation`) = **WRONG_DOMAIN**
- Demo/Opp proposal handoff ≠ create; e-sign provider **NOT_CONFIGURED**
- No silent FX; no fabricated prices/tax/discounts/approvals/delivery/acceptance/signatures
- APPROVED ≠ ISSUED ≠ DELIVERED ≠ VIEWED ≠ ACCEPTED
- Metric/report gate fail → never fabricated zero
- CoA admin stays removed; no MRA EIS fiscal from quotations

## Classification legend

| Class | Meaning |
|-------|---------|
| CORRECT_AND_REUSABLE | Keep as boundary / input; do not redefine |
| REUSE_WITH_RECONCILIATION | Reuse only with explicit mapping / honesty |
| EXTEND | Reuse and extend under commercial domain |
| STANDARDISE | Align multiple similar surfaces |
| FOUNDATION | Thin foundations present; needs Wave work |
| NOT_FOUND | Absent in codebase / schema |
| WRONG_DOMAIN | Exists but belongs to another plane |
| WRONG_SOURCE | Exists but must not be treated as authoritative commercial truth |
| NOT_AVAILABLE | Explicitly deferred with contract |
| FORBIDDEN | Must not be used / invented for this phase |
| BLOCKED | Cannot proceed until dependency cleared |
| FABRICATED_PRICE_RISK | Risk of inventing binding prices |
| TAX_RISK | Tax calculation / fiscal side-effect risk |
| CURRENCY_RISK | Silent FX or false multi-currency totals |
| DISCOUNT_GOVERNANCE_RISK | Ungoverned discount / below-floor pricing |
| APPROVAL_BYPASS_RISK | Missing or stub commercial approval |
| DOCUMENT_IMMUTABILITY_RISK | Issued artifact can be silently replaced |
| PUBLIC_LINK_RISK | Insecure or enumerable customer links |
| ACCEPTANCE_IDENTITY_RISK | Acceptance without verified identity/authority |
| SIGNATURE_RISK | Fabricated or misconfigured e-sign |
| CROSS_TENANT_RISK | Scope / isolation gap |
| CONTACT_PRIVACY_RISK | Consent / PII projection gap |
| PERFORMANCE_RISK | Scale / query risk |
| NOT_APPLICABLE | Out of commercial-document plane |

## Pack index

See Task 0 brief file list — audits (`CURRENT_*`, `COMMERCIAL_*`), matrices, `PHASE_15_GAP_REGISTER.md`, `IMPLEMENTATION_PLAN.md`, `FINAL_READINESS_DECISION.md`.
