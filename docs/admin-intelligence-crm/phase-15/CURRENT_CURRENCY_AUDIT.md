# Current Currency Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Opp ISO-4217 currency validation | CORRECT_AND_REUSABLE | `commercial.js` `isIso4217Currency`; amount+currency+basis required for readiness |
| Multi-currency summarize without FX | CORRECT_AND_REUSABLE | `summarizeAmountsByCurrency`; `fxConverted: false` |
| Pipeline reports by currency | CORRECT_AND_REUSABLE | `opportunities/reports.js` — no silent sum across currencies |
| CRM commercial document currency context | NOT_FOUND | — |
| Tenant currencyService | WRONG_DOMAIN / CURRENCY_RISK | `lib/currencyService.js` — defaults missing rate to **1.0** — FORBIDDEN as silent CRM FX |
| Accounting / consolidation FX | WRONG_DOMAIN | `accountingV2`, `reportingEngine/consolidationEngine` |

**Implication:** Wave 2 document currency explicit; combined multi-currency totals forbidden without approved FX snapshot.
