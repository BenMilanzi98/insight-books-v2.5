# Background Job Inventory

## Cron routes (6)

Listed under `app/api/cron/**/route.js` in inventory artifact.

## AcctV2 outbox

- Enqueue: `lib/accountingV2/infrastructure/outbox.js` (same transaction as post)
- Dispatcher / consumer: **MISSING** (SYS-DEF-004 / FSA-HIGH-OUTBOX)
- Impact: downstream projections/notifications relying on outbox will not drain

## Other workers

Depreciation, recurring expenses, EIS transmit/retry, statement import — must be idempotent. Crash windows documented in module docs; full chaos certification **NOT DONE**.

## Classification

Outbox dispatcher: **MISSING**  
Cron surfaces: **PARTIALLY_IMPLEMENTED**  
Idempotency of posting retries: **COMPLETE_REQUIRES_TESTING** (engine-level)
