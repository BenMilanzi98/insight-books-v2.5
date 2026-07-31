# Period Resolution Integration

Implementation: `lib/accountingV2/engine/periodResolution.js`
(`resolvePostingPeriod`), wrapping the current `AccountingPeriod` data and the
Phase 2 period contract. Full period-framework reimplementation is Phase 8;
this resolver is the seam the Phase 8 replacement will slot into.

## Resolution rules (as implemented)

1. The posting date determines the accounting period; both `transactionDate`
   and `postingDate` are preserved on the journal.
2. Resolution is server-side. Callers supply dates, never raw period IDs.
3. The period must belong to the same business.
4. Closed periods reject posting (`ClosedAccountingPeriodError`) — including
   inside the posting transaction, so a period closed between preview and post
   still fails safely (tested: "failed posting leaves no partial effect").
5. Backdated postings (date before the current open period) require the
   backdating permission and are flagged for audit
   (`InvalidPostingDateError` otherwise).
6. Future-dated postings beyond the policy window (31 days) are rejected.
7. **No silent skips** (Phase 1 finding P1-F09): if periods are configured for
   the business but no period covers the posting date, the resolver throws
   `InvalidAccountingPeriodError` — it does not fall through. Overlapping
   periods likewise produce an explicit error.
8. If the business has no periods configured at all, posting is refused with
   an explicit configuration error rather than proceeding unperioded.

## Outputs

`{ accountingPeriodId, periodStatus, financialYearLabel, postingDate }` —
stamped onto the journal (`accountingPeriodId`, `financialYearLabel`,
`postingDate` columns) and returned in the Posting Result.

Tests: period suite in `test/accountingV2.postingEngine.test.js` — open,
closed, reopened, missing, gap, overlap, backdating (authorized and
unauthorized), future-date and cross-business cases.
