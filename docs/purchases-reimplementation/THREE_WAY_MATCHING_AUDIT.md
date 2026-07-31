# Three-Way Matching Audit

## Verdict: `INCOMPLETE` / `BLOCKED` for acceptance criteria

No purchases matching service, statuses, tolerances, or UI found.

Bank reconciliation has `matchingStatus` — **unrelated**; do not reuse those enums for AP matching without a dedicated purchases domain.

## Current substitutes (insufficient)

| Mechanism | Limitation |
|-----------|------------|
| Header `purchaseOrderId` / `goodsReceiptId` on bill | No line match; no qty/price compare |
| Auto-bill copies GR lines | Assumes exact copy; no supplier invoice variance |
| Manual bill entry | Can diverge silently |

## Required statuses (target)

`NOT_REQUIRED` … `BLOCKED` per master prompt — implement as enum/string set on bill + line match results table.

## Required comparisons

Supplier, product/variant/service, ordered/received/accepted/billed qty, unit prices, tax, currency, warehouse/branch/project dims.

## Policy

- Do **not** auto-mutate PO or GR to match bill.
- Variance approval permission-gated.
- Overbilling blocked unless advance-billing policy.

## Classification of work

**New subsystem** (`REIMPLEMENT` from scratch on existing FKs) — not a small patch.
