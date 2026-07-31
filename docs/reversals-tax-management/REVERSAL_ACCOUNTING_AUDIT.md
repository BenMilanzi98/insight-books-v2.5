# Reversal Accounting Audit

## Correct path (KEEP)
Posted V2 journal → reverseJournal → REVERSAL_JOURNAL template → new Posted opposite journal linked via originalJournalId / reversedByJournalId.

## Document path
create*Reversal calls reverseSourceJournals first (fail-closed NO_V2_JOURNAL_TO_REVERSE), then negative operational row + audit TRANSACTION_REVERSED.

## Risks
- reverseSourceJournals forces JOURNAL_REVERSE permission true — bypasses real SoD
- Race: two concurrent reverses can create two document reversal children
- List API invoice original/reversal id mapping swapped vs expense mapping
- Stale integration test still expects legacy Transaction/balance mutations

## Period
checkAccountingPeriodLock uses accountingPeriod.status === 'closed'. Locked policy for Wave 2: reverse into current open period with explicit cross-period disclosure; block silent backdate.
