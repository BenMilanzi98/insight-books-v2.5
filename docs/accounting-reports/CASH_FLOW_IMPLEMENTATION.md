# Cash Flow Statement Implementation

`generateCashFlow` in `financialStatementService.js`, definition `CF-INDIRECT`
1.0.0. The indirect method is the default approved method; the direct method
(classifying cash-line counterparts) is future work behind the same contract.

## Method

Cash accounts are identified by explicit classification first
(`systemPurpose` CASH/BANK/MOBILE_MONEY, `cashFlowClassification`,
`coaV2SubType`) with a name assist for unclassified legacy accounts.

Starting from Net Profit (P&L account movements), each non-cash account's
period movement contributes `−Δ` (double entry: the cash movement is the
negative sum of non-cash movements):

- **Operating** — working-capital accounts (AR, inventory, prepayments, AP,
  accrued/tax liabilities) and the depreciation add-back (accumulated
  depreciation movement stays OPERATING — the classic indirect add-back, not
  an investing flow).
- **Investing** — fixed assets, intangibles, investments
  (explicit `cashFlowClassification = 'INVESTING'` or asset sub-types).
- **Financing** — loans/borrowings/lease liabilities and all equity movements
  (capital contributions, drawings, dividends).

Structure: Net Profit → Working Capital and Non-cash Movements → Net Cash from
Operating → Investing → Financing → Net Increase/(Decrease) in Cash → Opening
Cash → Closing Cash. Every adjustment line carries its source accounts and
drills down (basis PERIOD, `displaySign: -1` for the −Δ bucket lines).

## Validation (REP-004)

Two equations, both enforced without plug figures:

1. Opening cash + net movement = closing cash.
2. Closing cash per statement = closing balance of configured cash and
   cash-equivalent GL accounts.

If the classified movement differs from the GL cash movement (unclassified
counterpart accounts), the exact difference is disclosed as a blocking
REP-004 finding and the report is UNVERIFIED.

Fixture assertions: July — operating −7,500 (net profit 20,000 + working
capital −32,500 + depreciation add-back 5,000), financing −8,000 (drawings),
closing cash 884,500 = GL. June — financing 1,200,000 (capital + loan
proceeds), investing −300,000 (PPE purchase), operating 0 (stock bought on
credit nets inventory against AP).
