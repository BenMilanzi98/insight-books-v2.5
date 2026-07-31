# Conversion Source Matrix

| Source | Producer today | Creates Customer/Tenant/Subscription | Wave | Class |
|--------|----------------|--------------------------------------|------|-------|
| Phase 15 `createClosedWonConversionHandoff` | `phase16Handoff.js` | No — payload only | 1 seed CVR | CORRECT_AND_REUSABLE |
| Phase 15 `evaluateClosedWonReadiness` | `readiness.js` | No | 1 gate | CORRECT_AND_REUSABLE |
| Commercial acceptance | `acceptance.js` | No | 1 evidence | CORRECT_AND_REUSABLE |
| Opp `evaluateConversionReadiness` | `conversionReadiness.js` | No — handoff payload | 1 soft checklist | CORRECT_AND_REUSABLE / EXTEND |
| Manual approved conversion request | — | No | 1 | NOT_FOUND |
| Expansion / partner / reseller / API sources | — | No | 1–2 | NOT_FOUND |
| Phase 12 `closeOpportunityWon` | `close.js` | No provision | 1 early Closed Won | CORRECT_AND_REUSABLE |
| Acceptance alone | commercial | Must not Closed Won / provision | — | FORBIDDEN as auto-convert |
| Opp commercial estimate alone | `commercial.js` | Must not | — | WRONG_SOURCE |
| Tenant Quotation | `app/quotations` | Tenant AR only | — | WRONG_DOMAIN |
| Admin Tenant create | `admin/tenants` | Tenant + trial sub | 2 wrap | FOUNDATION / REUSE_WITH_RECONCILIATION |
| AI conversion planner | — | — | — | FORBIDDEN |

**Rule:** Conversion Requests are first-class. Phase 15 handoffs seed requests — convert idempotently. Never invent provision from acceptance, estimates, or Closed Won alone.
