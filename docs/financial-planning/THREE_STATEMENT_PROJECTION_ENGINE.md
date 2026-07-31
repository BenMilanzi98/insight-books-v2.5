# Three-Statement Projection Engine

Implementation: `lib/financialPlanning/domain/threeStatementEngine.js`  
Model version: `THREE_STATEMENT_V1`

## Order

1. Validate opening Balance Sheet balances  
2. Revenue (growth × seasonality)  
3. Cost of Sales (gross-margin driver)  
4. Operating expenses (% of revenue)  
5. Depreciation, interest, tax  
6. Net profit  
7. Working capital (DSO / DPO / inventory days)  
8. Capex / debt / equity schedules  
9. Indirect cash from BS identity  
10. KPIs + checksum + integrity status  

## Reconciliation

- Assets = Liabilities + Equity each period, or INVALID  
- CF closing cash = BS cash  
- Loan proceeds and capital contributions excluded from revenue  
- Principal, drawings, dividends excluded from operating expense  

## Circularity

Interest on revolving balances uses opening debt for the period (no iterative solver in V1). Documented as assumption-based.
