# Statement Import Design

## Formats

| Format | Parser | Notes |
|---|---|---|
| CSV / TSV | `csvParser.js` | Profile column map; delimiter auto-detect |
| XLSX / XLS | `xlsxParser.js` | Sheet name + skip rows |
| OFX / QFX | `ofxParser.js` | STMTTRN + BALAMT |

## Security

- Max 5 MB / 20,000 rows  
- Extension + magic-byte checks  
- SHA-256 file hash for idempotency (`tenantId + paymentAccountId + fileHash` unique)  
- Formula-injection neutralization on cells  

## Flow

1. `previewImport` → PREVIEWED batch + capped preview rows + balance check  
2. `confirmImport` → persist rows; skip duplicate fingerprints  
3. Link optional `reconciliationId`

## Balance validation

`opening + Σ signed movements = closing` (when both balances provided). Failure is a warning that blocks only if configuration requires it (preview records `balanceValid`).
