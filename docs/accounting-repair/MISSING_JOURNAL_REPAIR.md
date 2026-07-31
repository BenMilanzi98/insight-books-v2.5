# Missing Journal Repair

A journal is created for a historical event only when an authoritative
operational source proves it should exist (`MISSING_JOURNAL_REPAIR`).

## Validation before proposal

- Source exists, belongs to the business, is financial, reached a
  posting-required status, and was not cancelled before financial effect.
- No authoritative journal exists for the event (canonical source checked on
  BOTH ledgers) and no alternate event type already represents the effect.
- Amount, tax, currency, date and account mappings are all known and valid.
- A `posted = true` flag alone is NOT evidence — the flag itself may be the
  defect; that case is `SOURCE_STATUS_REPAIR` (flip the flag), not a new journal.

## Posting

The repair posts through the Phase 4 engine with the dedicated
`HISTORICAL_REPAIR_POSTED` event type (template `HISTORICAL_REPAIR`,
`HREP-` numbering): full validation pipeline, account validation, period
control, always-required approval, separation of duties, idempotency and audit.
Metadata stores the original source (type/id), original transaction date,
controlled posting date, repair reason, batch, anomaly, template and
architecture version.

Period treatment follows `CLOSED_PERIOD_REPAIR_POLICY.md`: the original
transaction date is preserved in the journal's transaction date or metadata; the
posting date is the approved adjustment date when the original period is closed.

Idempotency: the action identity + the engine's event registry guarantee a
missing journal can be created at most once per anomaly/repair version.
