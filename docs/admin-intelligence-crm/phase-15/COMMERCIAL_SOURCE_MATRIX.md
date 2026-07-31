# Commercial Source Matrix

| Source | Producer today | Creates Proposal/Quotation | Wave | Class |
|--------|----------------|---------------------------|------|-------|
| Opp evaluateProposalReadiness | `proposalReadiness.js` | No — handoff payload only | 1 seed PRQ | CORRECT_AND_REUSABLE |
| Demo emitDemoProposalHandoff | `demos/handoffs.js` | No — `proposalCreated: false` | 1 seed PRQ | CORRECT_AND_REUSABLE |
| Manual Proposal Request | — | No | 1 | NOT_FOUND |
| Sales/CS/partner request intake | — | No | 1 | NOT_FOUND |
| Qualify/convert Proposal Request | — | No | 1 | NOT_FOUND |
| Opp commercial estimate alone | `commercial.js` | No (must not issue) | — | WRONG_SOURCE / FABRICATED_PRICE_RISK if issued |
| Tenant Quotation create | `app/api/quotations` | Tenant Quotation only | — | WRONG_DOMAIN / FORBIDDEN as CRM source |
| Rentals quotation | rentalV2 | No CRM doc | — | WRONG_DOMAIN |
| PlatformPlanVersion publish | platformBilling | No | 2 Price Book ref | REUSE_WITH_RECONCILIATION |
| Closed Won | `close.js` | No | — | FORBIDDEN invent Proposal |
| Acceptance (future) | — | No auto Closed Won | 3–4 | CORRECT_AND_REUSABLE boundary |
| AI proposal generator | — | — | — | FORBIDDEN |
| Fabricated import of wins as quotes | — | — | — | FORBIDDEN |

**Rule:** Proposal Request and commercial documents are first-class. Handoffs seed requests — convert idempotently. Never invent issued documents from estimates, tenant quotes, or Closed Won.
