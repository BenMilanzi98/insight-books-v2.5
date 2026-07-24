# Bug hunt memories

| Bug (location + root cause) | PR | Status | Recorded |
|---|---|---|---|
| `lib/transactionJournalHelpers.js` createInvoiceJournalEntry: AR debit included line tax while revenue credits were net-only → unbalanced JE / invoice rollback; tax offset used revenue instead of AR; legacy opening-balances re-post desynced Account.balance; custom POS COGS trusted client cost | https://github.com/BenMilanzi98/insight-books/pull/1 | open | 2026-07-24 |
