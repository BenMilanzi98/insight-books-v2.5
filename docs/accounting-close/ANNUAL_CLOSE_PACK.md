# Annual Close Pack

Service: `lib/accountingClose/application/annualClosePackService.js`

## Contents

- Close run summary (method, P/L, approvers)
- Checklist task outcomes
- Exceptions (including accepted)
- Closing Journal Batch reference + checksum
- Post-Closing Trial Balance status
- Annual snapshot index
- Approval / status history
- Next-year opening reporting balances (continuous GL)
- Control confirmations

## Export

| Format | Endpoint |
|---|---|
| JSON | `GET/POST .../runs/:id/close-pack` |
| Excel | `GET .../runs/:id/close-pack?format=xlsx` |

Original snapshots remain immutable; the pack is a presentation of stored close evidence.
