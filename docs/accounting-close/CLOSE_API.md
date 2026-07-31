# Close APIs

| Method | Path | Purpose |
|---|---|---|
| GET/PUT | `/api/accounting-close/config` | Get / draft / approve configuration |
| GET | `/api/accounting-close/readiness?financialYearId=` | Readiness engine |
| GET/POST | `/api/accounting-close/runs` | List / create close run |
| GET | `/api/accounting-close/runs/:id` | Close run detail |
| POST | `/api/accounting-close/runs/:id/:action` | Checklist, approve, preview, post, PCTB, snapshots, close-year |
| GET/POST | `/api/accounting-close/reopen` | Impact / request / approve / execute |
| GET | `/api/accounting-close/runs/:id/close-pack?format=json\|xlsx` | Annual Close Pack |
| POST | `.../reverse-closing` | Explicit Closing Journal reversal |
| POST | `.../create-exception` / `resolve-exception` / `accept-exception` | Close exceptions |

No unrestricted year-status update endpoints.
