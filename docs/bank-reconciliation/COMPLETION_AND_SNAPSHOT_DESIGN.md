# Completion and Snapshot Design

## Calculation (no plug)

```
adjustedBook = bookBalance + depositsInTransit − outstandingPayments + adjustments
difference = statementClosing − adjustedBook
complete iff |difference| ≤ tolerance
```

## Lifecycle

`DRAFT → IN_PROGRESS → IN_REVIEW → APPROVED → COMPLETED`  
`COMPLETED → REOPENED` (prior row marked REOPENED; **new version** created)  
`COMPLETED|APPROVED|REOPENED → REVERSED` (matches reversed; snapshots retained)

## Separation of duties

When `requireSeparateApprover` is true, preparer cannot approve or complete.

## Snapshot

On complete, `BankRecSnapshot` stores immutable JSON: calculation, match/outstanding/adjustment IDs, balances. Snapshots are never updated; reopen creates a new recon version.
