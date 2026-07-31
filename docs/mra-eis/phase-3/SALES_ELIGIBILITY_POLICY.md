# Sales Eligibility Policy

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

`EisEligibilityResult evaluate(EisEligibilityInput)`

## Include (candidates)

- POS Sale status `completed` after accounting posted
- Sales Invoice non-Draft / issued after accounting posted

## Exclude

Quotation, estimate, proforma, Draft, unapproved, cancelled/voided source, payments, purchases, expenses, transfers, journals, budgets, opening balances, inventory-only

Corrections (void/credit/refund): eligibility only when Phase 1/MRA contract verified — otherwise MANUAL_REVIEW / blocked.

Result carries blockers, terminal, site, config versions, mapping refs, policyVersion.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
