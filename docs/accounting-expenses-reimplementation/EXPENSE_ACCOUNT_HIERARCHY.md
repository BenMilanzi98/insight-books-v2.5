# Design Stub — Expense Account Hierarchy

**Date:** 2026-07-25  
**Base:** `lib/chartOfAccountsBlueprint.js` (2026-07-25 forensic snapshot)  
**Tag:** `EXTEND` existing hierarchy; do not revive anti-blueprint 51xx opex tree.

## Target tree (system)

```
5000 Expenses                          [header]
├── 5100 Cost of Sales                 [header]
│   ├── 5110 Purchases
│   ├── 5120 Purchase Returns & Discounts
│   ├── 5130 Freight & Import Costs
│   └── 5140 Direct Labour
├── 5200 Salaries & Wages
├── 5205 Overtime & Premium Pay          ← ADD
├── 5210 Staff Benefits & Allowances
├── 5220 Employer Statutory Contributions
├── 5290 Inventory Adjustments           ← ADD (purpose already legacyCode 5290)
├── 5300 Rent & Lease
├── 5310 Utilities
├── 5315 Telecom & Internet
├── 5320 Office Supplies
├── 5330 Marketing & Advertising
├── 5340 Travel & Transport
├── 5345 Fuel & Vehicle                  ← ADD
├── 5350 IT & Hosting
├── 5360 Professional & Legal Fees
├── 5365 Licences & Permits              ← ADD
├── 5370 Insurance
├── 5380 Repairs & Maintenance
├── 5390 Bad Debts
├── 5400 Depreciation Expense
├── 5410 Amortization Expense
├── 5500 Bank Charges & Fees
├── 5510 Interest Expense
├── 5600 Meals & Entertainment
├── 5610 Training & Development
├── 5620 Project & Job Costs             ← ADD
├── 5650 Corporate Tax Expense           ← ADD
├── 5660 Foreign Exchange Loss           ← ADD
├── 5700 Custom Expenses                 [header]
│   └── 5701–5899 tenant-defined
└── 5900 All Other Expenses              [catch-all / reclassify]
```

## Mirror other income (for FX)

Add blueprint leaf for FX gain under other income band (purpose `FOREIGN_EXCHANGE_GAIN`) — code assigned in CoA V2 other-income range (not under 5000 if category is OTHER_INCOME).

## Selection rules

- Expense module picker: postable leaves under `5200–5899` plus explicit allow-list; **exclude** `5100–5199` unless COGS mode.  
- Include new leaves above once seeded.

## Migration note

Tenants with anti-blueprint children under `5100` Operating Expenses must remap via `lib/coaComprehensiveTemplateMap.js`-style jobs before relying on COGS filters.
