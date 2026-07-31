# Current Opportunity Value Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Opportunity amount / estimate fields | NOT_FOUND | No deal value on Crm* |
| Amount basis + currency | NOT_FOUND | — |
| Amount history | NOT_FOUND | — |
| Non-binding commercial estimate semantics | NOT_FOUND | Design requires non-binding |
| Phase 6 MRR / ARR as Opportunity value | FORBIDDEN | Wrong plane |
| Invoice / Quotation totals as Opportunity value | WRONG_DOMAIN | Billing / proposals later |
| Score as expected revenue | FORBIDDEN | Readiness `isExpectedRevenue: false` |
| False zero pipeline value | FORBIDDEN | Honesty gates |

**Implication:** Wave 2 commercial estimates with explicit currency + history; never mix with Phase 6 Revenue or invent zeroes.
