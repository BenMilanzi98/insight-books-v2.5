# Currency / FX Matrix

| Capability | Exists? | Path | Class |
|------------|---------|------|-------|
| ISO currency on Opp | Yes | commercial.js | CORRECT_AND_REUSABLE |
| Per-currency pipeline totals | Yes | reports.js | CORRECT_AND_REUSABLE |
| CRM FX snapshot service | No | — | NOT_FOUND → Wave 2 |
| Silent FX convert | Blocked by design on Opp | commercial.js fxConverted:false | CORRECT_AND_REUSABLE |
| Tenant currencyService rate default 1 | Yes | currencyService.js | CURRENCY_RISK / FORBIDDEN for CRM |
| Accounting FX | Yes | accountingV2 | WRONG_DOMAIN |
| Multi-currency false grand total | Must not | Design | FORBIDDEN |
