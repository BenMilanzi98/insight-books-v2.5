# Data Integrity Risk Register

| ID | Risk | Severity | Disposition |
|----|------|----------|-------------|
| D-01 | Float money on rates/totals | High | `REIMPLEMENT` Decimal |
| D-02 | Auto-complete without return/inspection | High | `UNSAFE` |
| D-03 | Partial return without idempotency | Medium | `EXTEND` |
| D-04 | Invoice 1:1 forced — cannot book without AR | High | `REIMPLEMENT` contracts |
| D-05 | No checksum/version on booking | Medium | `EXTEND` |
| D-06 | Historical kind=hiring semantics ambiguity | High | Document + migrate carefully |
