# Accounting and EIS Transaction Boundary

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

## Preferred local DB transaction

1–8: validate + finalize sale/invoice + payments + stock + **Accounting V2 post**
9: evaluate EIS eligibility
10–11: create immutable snapshot (or create-marker) + Outbox `EIS_TRANSMISSION_QUEUED`
12: audit
COMMIT

## After commit

Worker: MRA network call · response classify · receipt projection update

## Forbidden

MRA HTTP inside financial transaction. Retry must not create second Sale/Journal/stock move.

## Gap remediation if snapshot cannot join finalize tx

Recovery scanner for SALE without snapshot; alert; bounded lag; still no network in financial tx.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
