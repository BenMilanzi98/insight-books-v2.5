# Dry-Run Engine

`dryRunRepair` (`repairExecutionService.js`) is the mandatory preview for every
repair. It builds and validates the full strict command, loads the anomaly and
batch, and computes the complete expected impact **without a single write** —
no journals, no source changes, no period changes, no anomaly transitions, no
ledger projection updates, no event registry claims. Test coverage asserts a
byte-identical store before/after a dry run.

## Preview contents

- Anomaly summary (type, severity, confidence, status).
- Repair class, documented reason, evidence references.
- Expected journal: exact lines, total debit/credit in minor units, posting
  date, generated description.
- Metadata preview: per-field `{previous, next}` values read from the live row.
- Debit/credit impact, period impact.
- Approval requirement from the matrix (role, separation of duties, risk tier).
- Rollback plan for the repair class.
- **Warnings** (e.g. anomaly not yet approved, batch missing backup reference).
- **Blockers** (e.g. repair class not permitted for the anomaly type, unbalanced
  proposal, metadata target missing or cross-business) and a final
  `wouldExecute` verdict.

Dry-run output is JSON — exportable via the API and via
`scripts/accounting-repair.mjs preview --output file.json` for finance review.
