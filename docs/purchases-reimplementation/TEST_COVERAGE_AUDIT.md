# Test Coverage Audit

## Finding

No dedicated purchases/supplier/goods-receipt/bill/payment automated test suite located under `test/` (name patterns `*purchase*`, `*supplier*` empty for P2P).

MRA EIS fiscal receipt tests are unrelated.

Classification: **`INCOMPLETE`** — Critical scenarios 1–10 from the master prompt are **untested**.

## Required minimum suite (phase gates)

| Suite | Gate |
|-------|------|
| PO no journal / no stock | Block merge of posting changes |
| GR stock once + GRNI journal | Block GRNI cutover |
| Bill clears GRNI, no stock | Block bill template change |
| Payment settles AP only | Block payment changes |
| Partial GR ×2 | Idempotency |
| Overbill blocked | Matching |
| Duplicate supplier invoice | Integrity |
| Multi-tenant IDOR | Security |
| Retry/idempotency | Concurrency |

## Current result

| Metric | Value |
|--------|-------|
| P2P unit tests | ~0 found |
| P2P integration tests | ~0 found |
| E2E procure-to-pay | ~0 found |

Document results in `AUTOMATED_TEST_RESULTS.md` only after tests exist (no empty placeholders).
