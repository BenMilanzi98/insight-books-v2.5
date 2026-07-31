# Current Lead / Opportunity Conversion Audit (PRD 20)

**Audited:** 2026-07-31

| Check | Status | Class | Evidence |
|-------|--------|-------|----------|
| Lead ≠ Platform Customer | READY | CORRECT_AND_REUSABLE | Domain contract + match/create steps separate CRM Lead/Account from Platform Customer |
| Opportunity → Conversion request | READY | CORRECT_AND_REUSABLE | `createConversionRequestFromClosedWonHandoff` / CVR binds `opportunityId` |
| Opp conversion readiness checklist | READY | CORRECT_AND_REUSABLE | `opportunities/conversionReadiness.js` — never provisions |
| Lead already converted guard | PARTIAL | EXTEND | Orchestrator idempotency by request/input hash; deepen Lead-level duplicate conversion guard Wave 2 |
| Opportunity CLOSED_WON in saga | READY | CORRECT_AND_REUSABLE | Step `TRANSITION_OPPORTUNITY_CLOSED_WON` via `closeOpportunityWon` |
| Opportunity ≠ Conversion completion | READY | CORRECT_AND_REUSABLE | Status machine separates CLOSED_WON step from COMPLETED certificate |
| Expansion / existing customer types | PARTIAL | FOUNDATION | `CRM_CONVERSION_TYPE` includes EXISTING_CUSTOMER_NEW_SUBSCRIPTION; deepen Wave 2 |

**Implication:** Lead/Opp→Conversion path exists; Wave 2 focuses on identity duplicate + type coverage, not reinventing Opportunity.
