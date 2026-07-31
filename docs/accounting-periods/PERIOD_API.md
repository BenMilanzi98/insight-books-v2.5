# Period APIs

All routes under `/api/accounting-v2/periods/*`, guarded by
`guardAccountingRoute` (session business + permission checks). There is no
generic status-update endpoint.

| Route | Methods | Purpose |
| --- | --- | --- |
| `/financial-years` | GET | list years; `?id=` detail with periods |
| `/financial-years` | POST | `{action: preview \| create \| open}` |
| `/` (periods) | GET | canonical periods + calendar summary + config; filters `financialYearId`, `status` |
| `/[id]` | GET | period detail: status history, active close run + tasks, close runs, exceptions, reopen requests |
| `/[id]` | POST | `{action}` dispatch: `begin-close`, `cancel-close`, `run-checks`, `update-task`, `waive-task`, `add-exception`, `accept-exception`, `resolve-exception`, `submit-review`, `approve-close`, `close`, `request-reopen`, `approve-reopen`, `reject-reopen`, `impact`, `set-lock-date` — each with its own permission set |
| `/resolve` | POST | non-throwing posting-date validation (`validatePostingDate`) for forms/imports/webhooks |
| `/integrity` | GET | PER-101…110 audit + readiness assessment + monitoring findings |
| `/migration` | POST | `{action: preview \| execute}` legacy period migration (`accountingPeriods.migrate` for execute) |
| `/config` | GET/PUT | calendar configuration (reason required for lock-rule changes) |

Errors surface as typed accounting errors via `accountingErrorResponse`
(safe messages, request/correlation IDs, no DB internals).
