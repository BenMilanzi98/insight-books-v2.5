# Current Equity Architecture (pre / during Phase 11)

## Verdict

**Capital Account (owner contributions under CoA 3100) is operational.**  
Full Equity Management (owners/shareholders, drawings, dividends, share capital, ownership register) was **not** productized before Phase 11.

## What exists

```
TenantSettings.ownerContributedCapital  (settings counter — not GL authority)
EquityAccount (legacy sparse model — opening/currentBalance floats)
Capital Account UI/API
  └── postCapitalContributionAccounting → Posting Engine
        └── JournalEntry (ACCOUNTING_V2) → Owner Capital CoA

CoA purposes: OWNER_CAPITAL, SHARE_CAPITAL, OWNER_DRAWINGS,
              DIVIDENDS_PAYABLE, RETAINED_EARNINGS, OPENING_BALANCE_EQUITY

Templates ACTIVE: CAPITAL_CONTRIBUTION, OWNER_DRAWING,
                  DIVIDEND_DECLARATION, DIVIDEND_PAYMENT

Reports: Balance Sheet equity section + Statement of Changes in Equity (Phase 7)
```

## What was missing (Phase 11 scope)

- Business equity configuration / legal structure  
- Owner / partner / shareholder relationships (business-scoped)  
- Share classes, holdings, ownership % controls  
- Equity Transaction entity with approval + posting status  
- Drawing / dividend / share issuance / transfer workflows (productized)  
- Owner-loan vs capital classification  
- Equity subledger + capitalization table  
- Equity reconciliation engine (module-level)  
- Equity Management UI beyond Capital Account  

## Authority rules (locked)

1. Equity **financial** balances derive from posted V2 Journal Entry Lines.  
2. Subledgers and statements do not replace the GL.  
3. Contributions ≠ Revenue; drawings ≠ Expenses; dividends ≠ operating Expenses.  
4. Owner loans ≠ Equity unless formally converted.  
5. Contributions do **not** auto-change ownership percentages.  
6. All financial equity events post via Posting Engine.  
7. Legacy `EquityAccount.currentBalance` is **not** authoritative.

## Confusion guardrails

| Surface | Is it Equity Management V2? |
|---|---|
| `/capital-account` (legacy contributions) | Operational precursor — retained; V2 wraps/extends |
| Phase 7 equity reports | Reporting — consume GL, do not own workflows |
| `EquityAccount` Prisma model | Legacy — not recon identity for Phase 11 |
| `/equity-management` + `EqV2*` tables | Yes |
