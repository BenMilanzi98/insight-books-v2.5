# Legacy Year-End Migration Strategy

## Stage 1 — Inventory

Classify historical FY `CLOSED` flags, presence/absence of closing journals, RE manual updates, duplicate opening balances.

## Stage 2 — Canonical close runs

Create `CloseV2YearEndCloseRun` records for proven closes; link journals where evidenced. Preserve legacy IDs in metadata.

## Stage 3 — Checklist history

Reconstruct only where evidence exists. Do not invent approvals.

## Stage 4 — Recalculate PCTB

From canonical JE lines. Detect dual CYE/RE and duplicate OB.

## Stage 5 — V2 for future years

Uncertain historical years remain read-only legacy. Do not silently modify historical Closing Journals.
