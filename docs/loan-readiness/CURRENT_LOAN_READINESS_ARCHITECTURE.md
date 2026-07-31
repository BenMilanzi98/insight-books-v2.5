# Current Loan Readiness Architecture (pre–Phase 14)

## What exists

| Capability | Location | Notes |
|---|---|---|
| Liability / loan register | `Liability`, `LiabilityPayment` | Operational loans |
| Client amortization UI | `app/liability-management/page.js` | Floating EMI; not credit engine |
| Interest coverage / liquidity / leverage ratios | `lib/FinancialRatioUtils.js`, dashboard KPIs | No DSCR |
| GL loan subledger report | reporting services | Actuals |
| Phase 13 forecasts | `lib/financialPlanning/*` | Projected debt/cash KPIs for capacity inputs |
| Planning / close readiness APIs | cutover readiness | Not credit scoring |

## Defects for Phase 14

1. No internal readiness score or transparent weights  
2. No versioned DSCR formula  
3. No debt-capacity engine (must not use revenue alone)  
4. No proposed facility schedules that stay off the GL  
5. No covenant monitoring  
6. No lender / board package generator  
7. No assessment versioning or immutable snapshots  
8. Client-side amortization is not authoritative for credit analysis  

## Authority rules retained

- Actuals → canonical accounting / snapshots  
- Forecasts → identified PlanV2 forecast versions  
- Proposed loans → planning-only; never create Journal Entries  
