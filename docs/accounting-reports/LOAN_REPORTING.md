# Loan Reporting

`generateModuleReport(db, ctx, request, 'LOANS')` — credit-normal
presentation.

Covers loan liabilities (LOAN, LONG_TERM_LOAN, CURRENT_LOAN, BORROWING,
LEASE_LIABILITY sub-types; LOAN_PAYABLE purpose; name assist) and interest
expense (FINANCE_COST / INTEREST sub-types; interest assist).

Accounting validations built into the wider engine:

- Loan proceeds are liabilities — the Cash Flow classifies them FINANCING and
  the Income Statement structurally excludes them from revenue (tested).
- Principal repayment reduces the liability (debit to the loan account).
- Interest is an expense — it appears in the Income Statement Finance Costs
  line, never as principal.
- Closing loan balances agree with the GL by construction; the Balance Sheet
  Loans and Borrowings line reads the same canonical balances (REP-011
  differences from an operational loan register would surface through the
  reconciliation service).

Fixture assertion: loan 200,000 credit − interest expense 2,000 debit →
module total 198,000 in credit-normal presentation; June cash flow shows the
200,000 proceeds under financing. Repayment-schedule comparison remains the
loans module's operational screen.
