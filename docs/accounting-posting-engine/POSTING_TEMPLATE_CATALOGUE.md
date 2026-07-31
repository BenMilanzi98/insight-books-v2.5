# Posting Template Catalogue

24 templates registered at startup via `lib/accountingV2/templates/index.js`.
`ACTIVE` templates have full `buildDraft` implementations and tests; `DEFINED`
templates declare their accounting contract for Phase 9 integration and cannot
generate postings yet.

## ACTIVE (Phase 4 pilots) — `pilotTemplates.js`

| Template | Event type | Posting shape | Notes |
| --- | --- | --- | --- |
| `MANUAL_JOURNAL` v1 | `MANUAL_JOURNAL_POSTED` | User-supplied balanced lines | Primary NEW_ENGINE pilot; approval + separation of duties required |
| `ADJUSTMENT_JOURNAL` v1 | `ADJUSTMENT_POSTED` | User-supplied balanced lines | Reason + category mandatory; related journal linkage supported |
| `OPENING_BALANCE` v1 | `OPENING_BALANCE_POSTED` | Batch lines from `AcctV2OpeningBalanceBatch` | Unique per business/effective-date/version; evidence + approval required |
| `CUSTOMER_INVOICE` v1 | `INVOICE_POSTED` | Dr AR / Cr Revenue / Cr VAT Output | **Shadow-only** in Phase 4 — feeds legacy comparison, never posts to production |

## DEFINED (Phase 9 activation) — `definitions.js`

| Template | Conceptual posting |
| --- | --- |
| `CASH_SALE` | Dr Cash/Bank/Mobile Money, Cr Sales Revenue, Cr VAT Output |
| `CUSTOMER_PAYMENT` | Dr Cash/Bank/Mobile Money, Cr Accounts Receivable |
| `CUSTOMER_CREDIT_NOTE` | Dr Sales Returns + VAT Output adj., Cr Accounts Receivable |
| `SUPPLIER_BILL` | Dr Expense/Inventory/Asset + VAT Input, Cr Accounts Payable |
| `SUPPLIER_PAYMENT` | Dr Accounts Payable, Cr Cash/Bank |
| `CASH_EXPENSE` | Dr Expense + VAT Input, Cr Cash/Bank/Mobile Money |
| `PAYROLL` | Dr Salaries & Wages (5200 mapping) + employer costs, Cr PAYE/pension/deduction payables + Payroll Payable/Bank |
| `INVENTORY_PURCHASE` | Dr Inventory + VAT Input, Cr Accounts Payable/Bank |
| `COST_OF_SALES` | Dr Cost of Sales, Cr Inventory (approved valuation method) |
| `ASSET_ACQUISITION` | Dr Fixed Asset + VAT Input, Cr Accounts Payable/Bank |
| `DEPRECIATION` | Dr Depreciation Expense, Cr Accumulated Depreciation |
| `LOAN_RECEIPT` | Dr Bank, Cr Loan Liability (never Revenue) |
| `LOAN_REPAYMENT` | Dr Loan Liability + Interest Expense, Cr Bank (principal/interest split) |
| `CAPITAL_CONTRIBUTION` | Dr Cash/Bank/Asset, Cr Owner/Share Capital (never Revenue) |
| `OWNER_DRAWING` | Dr Owner Drawings, Cr Cash/Bank/Asset (never operating expense) |
| `DIVIDEND_DECLARATION` | Dr Retained Earnings/Dividends Declared, Cr Dividends Payable |
| `DIVIDEND_PAYMENT` | Dr Dividends Payable, Cr Bank |
| `BANK_CHARGE` | Dr Bank Charges Expense, Cr Bank |
| `INTEREST_INCOME` | Dr Bank, Cr Interest Income |
| `OPENING_STOCK` | Inventory opening valuation support (quantity + valuation evidence) |

Activation of any DEFINED template requires: full `buildDraft` implementation,
a source validator, tests, business CoA readiness, feature-flag scope for the
event, and finance approval — per `CONTROLLED_ROLLOUT.md`.
