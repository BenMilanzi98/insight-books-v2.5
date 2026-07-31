# Background Jobs Audit — System Audit

| Status | **STUB — cron routes inventoried** |

## Cron routes (6)

| Route | Purpose |
|---|---|
| `/api/cron/daily-report` | Daily report generation |
| `/api/cron/eis-sync` | EIS sync |
| `/api/cron/expire-trials` | Trial expiry |
| `/api/cron/subscription-expiry-reminders` | Subscription emails |
| `/api/cron/apply-deferred-goods-receipts` | Deferred GRNI |
| `/api/cron/pos-cash-day` | POS cash day |

## Missing background workers

| Component | Status |
|---|---|
| AcctV2 outbox dispatcher | **NOT IMPLEMENTED** (P2-06) |
| Ledger integrity monitor | Flag-gated only |
| Report cache warmer | Optional / manual |

## Cutover note

Phase 18 includes `BACKGROUND_JOB_FREEZE.md` — jobs must be frozen during migration window.

## TO FILL

- Cron auth secret rotation evidence
- Job failure alerting hooks
- Last-run timestamps from production
