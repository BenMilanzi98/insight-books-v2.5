# Current Price Book Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| CRM Price Book / PB- | NOT_FOUND | No `PriceBook` / `CrmPriceBook` in schema or `lib/admin/crm` |
| Price Book versions / entries | NOT_FOUND | — |
| ACTIVE version immutability | NOT_FOUND | Design requirement — unimplemented |
| PlatformPlanVersion.basePrice | WRONG_DOMAIN / REUSE_WITH_RECONCILIATION | Platform billing plan versions — not CRM Price Book |
| subscriptionConfig hardcoded CORE/EIS prices | WRONG_SOURCE | `lib/subscriptionConfig.js` — storefront defaults |
| Tenant Product.unitPrice | WRONG_DOMAIN | Tenant catalogue pricing |
| RentalRatePlan | WRONG_DOMAIN | Rentals |
| Opp unitAmountEstimate | FABRICATED_PRICE_RISK | Manual free-form — not Price Book entry |

**Implication:** Wave 2 greenfield CRM Price Books. May reference Phase 9 / PlatformPlanVersion IDs as entry product refs with reconciliation — never treat live plan price as mutable issued quote without snapshot.
