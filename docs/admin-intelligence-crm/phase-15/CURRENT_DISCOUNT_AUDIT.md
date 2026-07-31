# Current Discount Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| CRM discount policies / requests | NOT_FOUND | — |
| CRM discount thresholds / floors / SoD | NOT_FOUND | DISCOUNT_GOVERNANCE_RISK until Wave 2 |
| Tenant Quotation.discount / item discountRate | WRONG_DOMAIN | Tenant AR discounts |
| Platform invoice line discount reconcile | WRONG_DOMAIN | `platformBilling.js` |
| Free-form Opp unitAmountEstimate as de facto discount | FABRICATED_PRICE_RISK / DISCOUNT_GOVERNANCE_RISK | Manual amounts without policy |

**Implication:** Wave 2 policy-driven discounts; protected paths require approval; requesters cannot self-approve.
