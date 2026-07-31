# Accounting Posting Engine

## Canonical entry

`lib/accountingV2/engine/postingEngine.js`

- `previewPosting` — no writes
- `executePosting` — claim → validate → persist → audit → outbox

## Guarantees (designed)

1. Tenant/business/period/account/balance validation
2. Debits = credits
3. Idempotent replay returns original journal
4. Conflicting duplicate rejected
5. No manual Account.balance mutation as truth

## Result

**COMPLETE_REQUIRES_TESTING** for engine core; **PARTIALLY_IMPLEMENTED** for universal source cutover.
