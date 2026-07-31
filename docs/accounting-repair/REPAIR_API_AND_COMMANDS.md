# Repair API and Commands

## HTTP API (all under `app/api/accounting-v2/repair/`)

| Endpoint | Methods | Actions |
|---|---|---|
| `/api/accounting-v2/repair/anomalies` | GET, POST | List with filters (status, type, severity, confidence, module, period, source); `{action:"detect"}` runs detection. |
| `/api/accounting-v2/repair/anomalies/[id]` | GET, POST | Detail with evidence + actions; `add-evidence`, `transition`, `propose`, `approve`, `reject`, `mark-exception`. |
| `/api/accounting-v2/repair/batches` | GET, POST | List; create DRAFT batch. |
| `/api/accounting-v2/repair/batches/[id]/[action]` | GET, POST | `detail` (with actions + snapshots), `transition`, `snapshot`, `dry-run`, `execute`, `verify`, `rollback-action`. |
| `/api/accounting-v2/repair/exceptions` | GET | Exception register. |

Every route: authenticated session → business-scoped accounting context →
specific `accountingRepair.*` permission → service call → audit log. No raw
SQL, no arbitrary field updates — bodies are parsed into the strict structures
(`buildRepairCommand`, whitelists) server-side.

## CLI — `scripts/accounting-repair.mjs`

```
node --import ./scripts/registerAliasLoader.mjs scripts/accounting-repair.mjs <command> [options]

Commands: audit | list | preview | verify | reconcile
Options:  --business <id> --user <id> --anomaly <id> --batch <id>
          --status --type --severity --limit --output <file> --verbose
          --confirm-production
```

- `audit` — run detection for a business, persist anomalies, print summary.
- `list` — filtered anomaly listing.
- `preview` — dry-run a proposed repair for an anomaly (exports full preview).
- `verify` — verify a completed batch.
- `reconcile` — business-scoped ledger reconciliation.

Production guard: when `NODE_ENV=production` or the database URL is not a known
dev host, the CLI exits unless BOTH `--confirm-production` and
`ACCOUNTING_REPAIR_ALLOW_PRODUCTION=1` are provided. Execution of financial
repairs is deliberately NOT exposed as a bare CLI command — execution goes
through the API/console where approval, batch and permission state are
enforced.

Output is JSON (BigInt-safe), suitable for `--output` file export and finance
review.
