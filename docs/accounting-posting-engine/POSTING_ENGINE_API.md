# Posting Engine API

All routes live under `app/api/accounting-v2/` and pass through
`lib/accountingV2/api/routeGuard.js` (session auth, permission check,
AccountingContext construction, typed-error → safe JSON mapping). There is
**no** generic public journal-posting endpoint; operational modules will call
the internal application services in Phase 9.

## Manual / adjustment journals

| Route | Method | Permission | Purpose |
| --- | --- | --- | --- |
| `/api/accounting-v2/journals` | GET | `journal.view` | Paginated list, filter by status/type |
| `/api/accounting-v2/journals` | POST | `journal.create` | Create draft (manual or adjustment) |
| `/api/accounting-v2/journals/{id}` | GET | `journal.view` | Detail + lines + event history |
| `/api/accounting-v2/journals/{id}` | PATCH | `journal.create` | Edit while DRAFT only |
| `/api/accounting-v2/journals/{id}/submit` | POST | `journal.submit` | DRAFT → PENDING_APPROVAL |
| `/api/accounting-v2/journals/{id}/approve` | POST | `journal.approve` | Approve (separation of duties) |
| `/api/accounting-v2/journals/{id}/reject` | POST | `journal.approve` | Reject back |
| `/api/accounting-v2/journals/{id}/cancel` | POST | `journal.create` | Cancel before posting |
| `/api/accounting-v2/journals/{id}/preview` | POST | `accountingPosting.preview` | Read-only engine preview |
| `/api/accounting-v2/journals/{id}/post` | POST | `journal.post` | Post via central engine |

## Opening balances

| Route | Method | Permission |
| --- | --- | --- |
| `/api/accounting-v2/opening-balances` | GET/POST | `openingBalances.create` (POST) |
| `/api/accounting-v2/opening-balances/{id}/submit\|approve\|cancel\|preview\|post` | POST | `openingBalances.*` per action |

## Diagnostics and history

| Route | Method | Permission | Purpose |
| --- | --- | --- | --- |
| `/api/accounting-v2/events` | GET | `accountingPosting.view` | Paginated event history + attempts + shadow detail |
| `/api/accounting-v2/posting-engine` | GET | `accountingDiagnostics.view` | Engine status, modes, counters, comparisons, templates, metrics |

## Retry

Failed retryable events are retried by re-invoking the post action for the
source (manual journal / opening balance): the engine reuses the claimed event
identity, increments the attempt count, and refuses non-retryable failures
(`retryPosting` semantics). No standalone unauthenticated retry endpoint
exists.

## Error shape

```json
{ "error": { "code": "CLOSED_ACCOUNTING_PERIOD", "message": "…", "retryable": false,
  "requestId": "…", "correlationId": "…", "issues": [ … ] } }
```
