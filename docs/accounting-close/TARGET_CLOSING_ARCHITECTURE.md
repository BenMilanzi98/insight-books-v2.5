# Target Closing Architecture

## Separation

| Concern | Owner |
|---|---|
| Financial Calendar / periods | Phase 8 (`lib/accountingV2/periods`) |
| Period-end close | Phase 8 Period Close Run — **no** temporary-account zeroing |
| Year-end close | Phase 12 (`lib/accountingClose`) |
| Closing Journals | Closing Journal Batch → Posting Engine |
| Profit transfer | Single Closing Batch (MODEL A CYE) |
| Carry-forward | Continuous GL — reporting balances only |
| Reopen / reclose | New close version; originals immutable |

## Module layout

```
lib/accountingClose/
  domain/          enums, errors, checklist, temporary accounts, journal generator
  application/     config, readiness, close run, batch, PCTB, reopen
  api/             route guard
  permissions.js
app/api/accounting-close/
app/accounting-close/
```

## Close flow

See `CLOSING_DATA_FLOW_MAP.md`.
