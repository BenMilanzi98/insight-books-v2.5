# Journal Draft Generation

Implementation: `lib/accountingV2/domain/journalDraft.js` (draft structure +
invariants) and the `buildDraft` functions in
`lib/accountingV2/templates/pilotTemplates.js`.

## Draft contents

Header: business, source reference, event type, template ID + version,
transaction date, posting date, financial year label, accounting period,
currency, exchange rate, description, dimensions, approval reference,
attachment references, metadata, architecture version.

Lines: account ID, debit, credit (decimal strings, exactly one of the two per
line), base debit/credit, foreign amount where relevant, currency, exchange
rate, line description, sequence, and dimension fields (customer, supplier,
employee, owner, shareholder, bank account, loan, asset, project, branch,
department, cost centre, tax code, due date, metadata).

## Rules

1. **Templates never persist.** `buildDraft` is a pure function from
   `(source, command, resolvedAccounts)` to a draft object. Persistence
   happens only in `journalPersistence.js`, only after the full validation
   pipeline passes, only inside the posting transaction.
2. Draft construction normalizes all amounts through `domain/money.js`
   (exact decimal strings, currency scale enforced).
3. Line sequence is assigned deterministically so replays and comparisons are
   stable.
4. Drafts carry everything needed for validation — nothing is re-derived
   after validation, eliminating validate/persist divergence.
5. Preview and posting use the **same** draft generation path
   (`runValidationPipeline`), so a preview is a faithful dry run.
