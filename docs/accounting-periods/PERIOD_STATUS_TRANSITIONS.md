# Period Status Transitions

State machine: `PERIOD_TRANSITIONS` in `periodEnums.js`; the only writer is
`transitionPeriod` in `periodLifecycleService.js`.

```
DRAFT ──OPEN──▶ OPEN ──BEGIN_CLOSE──▶ CLOSING ──CLOSE──▶ CLOSED
                 ▲                       │                  │
                 └──────CANCEL_CLOSE─────┘        APPROVE_REOPEN
                                                         ▼
                          CLOSING ◀──BEGIN_RECLOSE── REOPENED
```

Forbidden (enforced by the map — `transitionPeriod` throws):

- DRAFT → CLOSED (must open and pass validation first)
- CLOSED → OPEN directly (only the reopening workflow → REOPENED)
- deletion of CLOSED or REOPENED periods (no delete path exists)
- any client-side status write (no API mutates `status` directly)
- silent status changes from imports (imports have no status surface)

Every successful transition appends an `AcctV2PeriodStatusHistory` row
(previous/new status, action, reason, requestedBy/approvedBy/executedBy,
requestId, correlationId, timestamp, metadata). History rows are never
updated or deleted by any workflow.

Lock-date changes (`setPeriodLockDate`) require a reason, write an audit
record and a `LOCK_DATE_CHANGED` history entry; period status remains the
primary control above lock dates.
