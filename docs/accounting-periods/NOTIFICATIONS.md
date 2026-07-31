# Notifications

Period events publish to the V2 outbox (`AcctV2Outbox`) via
`enqueueOutboxMessage`, the same channel used by Phases 4–7; the existing
outbox dispatcher fans out to notification consumers.

## Events published

| Event | Trigger |
| --- | --- |
| `acctv2.period.closeStarted` | `beginPeriodClose` |
| `acctv2.period.closed` | `closePeriod` (atomic, inside the closure transaction) |
| `acctv2.period.reopenRequested` | `requestReopen` |
| `acctv2.period.reopened` | `approveReopen` |
| `acctv2.period.reopenRejected` | `rejectReopen` |

Monitoring findings (period approaching end, overdue close tasks, blocking
exceptions, TB unbalanced, overdue re-close, missing current period) are
returned by `runPeriodMonitoring` for the scheduler's notification hook.

Payloads carry business, period, year, action and actor IDs — never
financial detail or attachments, so unauthorized recipients cannot learn
sensitive amounts from a notification alone.
