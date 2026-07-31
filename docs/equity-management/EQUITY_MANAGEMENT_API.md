# Equity Management API

Base: `/api/equity-management`

| Method | Path | Purpose |
|---|---|---|
| GET/PUT | `/config` | Equity configuration |
| GET/POST | `/owners` | List/create relationships |
| GET/PATCH/DELETE | `/owners/[id]` | Detail / exit / safe delete |
| GET/POST | `/transactions` | List/create equity txs |
| POST | `/transactions/[id]/submit\|approve\|preview\|post` | Lifecycle |
| GET/POST | `/dividends` | Declare / post / pay |
| GET/POST | `/holdings` | Holdings, cap table, share classes |
| POST | `/reconcile` | Equity reconciliation run |
| GET | `/dashboard` | Dashboard totals |
| GET | `/statements/[relationshipId]` | Owner capital statement |

All routes require `equityManagementV2Enabled` and `equity.*` permissions.
