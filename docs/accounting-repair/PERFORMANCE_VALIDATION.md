# Performance Validation

## Design constraints (implemented)

- Detection paginates journal/transaction scans (cursor-style batched reads);
  duplicate grouping and balance comparisons use database aggregation, not
  in-memory joins of full tables.
- One scoped transaction per repair action — never one transaction per batch or
  per platform. Lock scope is the action's journal/source rows only.
- Ledger rebuild and reconciliation are business-scoped (Phase 5 services);
  repairing one business never rebuilds others.
- Batches record per-action progress; interruption resumes from the idempotent
  identity, so long batches never restart from scratch.
- Snapshots aggregate in the database (account totals map) rather than loading
  journal lines.
- No external API calls inside repair transactions (outbox pattern for
  events).
- Conflicting concurrent execution is rejected by unique constraint rather
  than long lock waits.

## Measured on the dev database (restored production-like copy)

- Full detection pass across all tenants: seconds-scale end to end (all six
  detectors + Phase 5 reconciliation), dominated by the reconciliation
  queries already validated for scale in Phase 5.
- Anomaly registry writes: 8 upserts, idempotent rerun produced 0 additional
  writes.
- Test suite (34 tests, including batch execute/verify cycles): ~2s.

## Guidance for production scale

Start with detection `--business` scoped runs; batch sizes of 50–200 actions
per repair batch (per-action transactions keep lock windows small regardless);
run one batch per business at a time to avoid conflicting account/period scopes
(parallel batches on the same accounts are rejected only at identity level, so
scheduling discipline is still required); use maintenance windows for
journal-creating categories per `PRODUCTION_REPAIR_STRATEGY.md`.
