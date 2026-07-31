# Legacy / V2 Conflict Repair

Phase 5 canonical authority rules decide, per event, which ledger is
authoritative; Phase 6 repairs events where BOTH a legacy journal and a V2
journal carry active financial effect.

## Detection

Rule GL-117 (`runLedgerReconciliation`) flags source events represented on both
ledgers where the V2 side is a non-shadow posted journal — mapped to
`LEGACY_V2_DUPLICATION` (CRITICAL, CONFIRMED).

## Investigation

Per event: posting mode at the time, event identity (registry), legacy source
link, V2 source link, shadow status (shadow journals are excluded from totals
by construction and are NOT conflicts), whether lines match, which architecture
was authoritative under the cutover rules, and whether the event legitimately
produced multiple accounting effects.

## Repair

- Authoritative journal preserved.
- Non-authoritative ACTIVE duplicate reversed via `DUPLICATE_EFFECT_REPAIR`
  (HREP- reversal); nothing deleted.
- Source posting status and accounting-event authority corrected
  (`SOURCE_STATUS_REPAIR` where the flag disagrees).
- Recurrence prevented: the legacy posting guard (Phase 4) blocks new legacy
  writes for engine-owned events, and the event registry's idempotency blocks
  V2 double posting.
- Ledger rebuilt; verification proves the event contributes exactly once.

## Dev-dataset result

No active legacy/V2 duplicate found (V2 rollout used shadow mode; shadow
journals carry no financial effect). The path is fixture-tested for production
datasets.
