# Loan Readiness Centre (Phase 14)

Internal advisory financing preparation: DSCR, debt capacity, scoring, covenants, and lender packs.

**Not** a bank, lender decision, credit bureau score, or funding guarantee.

## Rules

- Proposed facilities never create Journal Entries or Liability records  
- Actuals from canonical accounting / snapshots  
- Forecasts from identified Phase 13 versions when linked  
- Score weights transparent and sum to 100%  
- Protected personal attributes excluded  
- AI commentary review-only (flag off by default)  

## Entry points

- UI: `/loan-readiness` (sidebar: **Loan Readiness**)  
- APIs: `/api/loan-readiness/*`  
- Library: `lib/loanReadiness/`  

## Verify

```bash
npx prisma migrate deploy
npx vitest run test/loanReadiness.engine.test.js
```
