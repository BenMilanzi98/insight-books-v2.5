# Commercial Reliability Matrix

| Gate aspect | Exists? | Class | Wave |
|-------------|---------|-------|------|
| Identity (Account/Contact) | Upstream yes | CORRECT_AND_REUSABLE | 1+ |
| Document versions | No | NOT_FOUND | 1 |
| Price Book + snapshot | No | NOT_FOUND | 2 |
| Currency / FX context | Partial (Opp only) | FOUNDATION / NOT_FOUND | 2 |
| Tax context | No | NOT_FOUND | 2 |
| Discount/exception approvals | No | NOT_FOUND | 2 |
| Template/clause pins | No | NOT_FOUND | 3 |
| Artifact checksum | No | NOT_FOUND | 3 |
| Delivery/response evidence | No | NOT_FOUND | 3 |
| DQ / recon | No | NOT_FOUND | 4 |
| Report honesty EMPTY/UNAVAILABLE | Pattern yes | CORRECT_AND_REUSABLE pattern | 4 |
| False zero on gate fail | Forbidden | FORBIDDEN | All |
