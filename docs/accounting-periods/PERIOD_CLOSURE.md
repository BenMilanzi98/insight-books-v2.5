# Period Closure

`closePeriod(db, context, closeRunId, {reason})` — atomic, single Prisma
transaction.

## Preconditions (validated inside the transaction)

1. Run belongs to the business and is `APPROVED`.
2. Period is `CLOSING`.
3. All required tasks complete; all blocking tasks passed/waived.
4. No unresolved blocking exceptions (always-blocking categories can never
   be waived).
5. Trial Balance status acceptable (`BALANCED` / `BALANCED_WITH_WARNINGS`).
6. Approval exists with separation of duties.
7. No other active close run.

## Atomic effects

1. Period status → `CLOSED` (via `transitionPeriod`, with history row).
2. `closedAt` / `closedBy` / `closeReason` recorded.
3. Close run → `COMPLETED` with `completedAt`.
4. Final report snapshots generated/linked (Phase 7 report runs; see
   PERIOD_REPORT_SNAPSHOTS.md) and referenced on the run.
5. Close audit record (`recordAccountingAudit`).
6. Outbox event `acctv2.period.closed` for notifications/integrations.

Any failure rolls back everything — a period can never be half-closed.
Closure never modifies journal amounts, never deletes records and never
creates balancing journals (asserted by tests: an unbalanced TB blocks the
run with the difference displayed, and the journal count is unchanged).
