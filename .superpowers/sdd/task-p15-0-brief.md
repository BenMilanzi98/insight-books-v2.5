### Task 0: Wave 0 — Forensic audits + matrices + readiness

**Depends on:** Phase 14 exit `READY_FOR_PHASE_15_WITH_BLOCKERS`; approved Phase 15 design + plan.

**Do NOT write application code, Prisma models, APIs, UI, or SQL migrations.** Docs under `docs/admin-intelligence-crm/phase-15/` only.

**Do NOT git commit** (user must request commits).

## Required deliverables

Create non-empty docs with real findings (paths, classifications, evidence). Match Phase 14 Wave 0 style. At minimum create:

```
docs/admin-intelligence-crm/phase-15/
├── README.md
├── PHASE_15_SCOPE.md
├── PHASE_INPUT_VALIDATION.md
├── CURRENT_PROPOSAL_ARCHITECTURE_AUDIT.md
├── CURRENT_QUOTATION_ARCHITECTURE_AUDIT.md
├── CURRENT_COMMERCIAL_DOCUMENT_AUDIT.md
├── CURRENT_PRICE_BOOK_AUDIT.md
├── CURRENT_PRODUCT_PRICING_AUDIT.md
├── CURRENT_PLAN_PRICING_AUDIT.md
├── CURRENT_ADD_ON_PRICING_AUDIT.md
├── CURRENT_CURRENCY_AUDIT.md
├── CURRENT_FX_AUDIT.md
├── CURRENT_TAX_CALCULATION_AUDIT.md
├── CURRENT_DISCOUNT_AUDIT.md
├── CURRENT_PRICING_EXCEPTION_AUDIT.md
├── CURRENT_COMMERCIAL_APPROVAL_AUDIT.md
├── CURRENT_COMMERCIAL_TERM_AUDIT.md
├── CURRENT_COMMERCIAL_CLAUSE_AUDIT.md
├── CURRENT_PROPOSAL_TEMPLATE_AUDIT.md
├── CURRENT_QUOTATION_TEMPLATE_AUDIT.md
├── CURRENT_DOCUMENT_RENDERING_AUDIT.md
├── CURRENT_DOCUMENT_STORAGE_AUDIT.md
├── CURRENT_DOCUMENT_DELIVERY_AUDIT.md
├── CURRENT_CUSTOMER_REVIEW_AUDIT.md
├── CURRENT_CUSTOMER_ACCEPTANCE_AUDIT.md
├── CURRENT_E_SIGNATURE_AUDIT.md
├── CURRENT_DOCUMENT_EXPIRY_AUDIT.md
├── CURRENT_REVISION_AUDIT.md
├── CURRENT_COMMERCIAL_REPORT_AUDIT.md
├── CURRENT_COMMERCIAL_EXPORT_AUDIT.md
├── COMMERCIAL_DATA_QUALITY_AUDIT.md
├── COMMERCIAL_RECONCILIATION_AUDIT.md
├── COMMERCIAL_PRIVACY_AUDIT.md
├── COMMERCIAL_SECURITY_AUDIT.md
├── COMMERCIAL_PERFORMANCE_AUDIT.md
├── COMMERCIAL_SOURCE_MATRIX.md
├── PROPOSAL_DOMAIN_MATRIX.md
├── QUOTATION_DOMAIN_MATRIX.md
├── PRICE_BOOK_MATRIX.md
├── PRODUCT_PRICING_MATRIX.md
├── CURRENCY_FX_MATRIX.md
├── TAX_MATRIX.md
├── DISCOUNT_MATRIX.md
├── PRICING_EXCEPTION_MATRIX.md
├── APPROVAL_MATRIX.md
├── TERMS_CLAUSE_MATRIX.md
├── TEMPLATE_MATRIX.md
├── DELIVERY_MATRIX.md
├── ACCEPTANCE_MATRIX.md
├── COMMERCIAL_RELIABILITY_MATRIX.md
├── COMMERCIAL_SECURITY_MATRIX.md
├── PHASE_15_GAP_REGISTER.md
├── IMPLEMENTATION_PLAN.md
└── FINAL_READINESS_DECISION.md
```

Classification legend (use as applicable): CORRECT_AND_REUSABLE, REUSE_WITH_RECONCILIATION, EXTEND, STANDARDISE, FOUNDATION, NOT_FOUND, WRONG_DOMAIN, WRONG_SOURCE, NOT_AVAILABLE, FORBIDDEN, BLOCKED, FABRICATED_PRICE_RISK, TAX_RISK, CURRENCY_RISK, DISCOUNT_GOVERNANCE_RISK, APPROVAL_BYPASS_RISK, DOCUMENT_IMMUTABILITY_RISK, PUBLIC_LINK_RISK, ACCEPTANCE_IDENTITY_RISK, SIGNATURE_RISK, CROSS_TENANT_RISK, CONTACT_PRIVACY_RISK, PERFORMANCE_RISK, NOT_APPLICABLE.

## Validate inputs

- `docs/admin-intelligence-crm/phase-14/PHASE_15_INPUTS.md`
- `docs/admin-intelligence-crm/phase-14/PHASE_15_READINESS_CHECKLIST.md`
- `docs/admin-intelligence-crm/phase-14/FINAL_PHASE_14_REPORT.md`
- Design: `docs/superpowers/specs/2026-07-31-commercial-documents-phase-15-design.md`
- Plan: `docs/superpowers/plans/2026-07-31-commercial-documents-phase-15.md`

Explore codebase for: CrmProposal (none), tenant Quotation (WRONG_DOMAIN), Opp commercial estimates, proposalReadiness, conversionReadiness, Demo proposal handoffs, plan/add-on pricing, currency/FX, tax, discounts, approvals, PDF/storage, public links, e-sign.

## Locked design (must reflect)

- Approach 1: CrmCommercialDocument spine; Proposal/Quotation typed extensions
- Real deterministic PDF renderer; e-sign NOT_CONFIGURED
- New CRM Price Books; in-platform tax + explicit FX snapshots
- Approach B waves; expected decision **CONDITIONAL GO** for Wave 1 unless true BLOCKED
- Tenant Quotation = WRONG_DOMAIN; acceptance ≠ Closed Won; handoff ≠ create

## Acceptance

- [ ] All listed docs exist with real findings (not empty placeholders)
- [ ] Phase input validation recorded
- [ ] Gap register + IMPLEMENTATION_PLAN maps gaps → Waves 1–4
- [ ] FINAL_READINESS_DECISION records CONDITIONAL GO or BLOCKED with reasons
- [ ] No application code written
- [ ] No git commit

## Report

Write full report to `.superpowers/sdd/task-p15-0-report.md`. Return only status, one-line summary, concerns, report path.
