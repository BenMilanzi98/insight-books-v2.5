# Journal and Ledger API, UI, Exports, Security, Audit

All routes are server-guarded (`guardAccountingRoute`): session auth, business
scope from the session (never from client input), permission checks, typed
error responses. All figures come from the canonical services — no route runs
its own ledger query.

## Routes

| Route | Method | Permission | Purpose |
| --- | --- | --- | --- |
| `/api/accounting-v2/ledger` | GET | `ledger.view` | Per-account opening / movement / closing summary; `view=hierarchy` returns the presentation tree. Params: `startDate`, `endDate`, `branchId`, `includeZero` |
| `/api/accounting-v2/ledger/account/[id]` | GET | `ledger.view` | Account activity with running balances; merge-rollup aware. Params: dates, `branchId`, `currency`, `dimensionKey`/`dimensionValue`, `page`, `pageSize`, `order` |
| `/api/accounting-v2/ledger/journals` | GET | `journal.view` or `ledger.view` | Canonical journal explorer across both stores (no double listing); `?id=` returns full detail with lineage. Filters: status, entryType, sourceType/Id, journalKind, dates, branch, search, includeNonPosted, includeMirrors |
| `/api/accounting-v2/ledger/export` | GET | `ledger.export` | CSV export using the same query contract as the screen |
| `/api/accounting-v2/ledger/rebuild` | POST / GET | `ledger.rebuild` | Rebuild projection (supports `dryRun`) / current projection status |
| `/api/accounting-v2/ledger/reconciliation` | POST | `ledger.reconcile` | Run reconciliation, returns the findings report |
| `/api/accounting-v2/journals/[id]/reverse` | POST | `journal.reverse` | Reverse a posted V2 journal through the engine |
| `/api/accounting-v2/journals/[id]/preview-reversal` | POST | `journal.reverse` | Preview the reversal draft without posting |

## Permissions added in Phase 5

`ledger.export`, `ledger.rebuild`, `ledger.reconcile`, `ledger.viewIntegrity`,
`journal.export` — in `lib/accountingV2/permissions.js`, enforced server-side
per route. Existing `ledger.view` / `journal.view` / `journal.reverse` keys
are reused.

## Exports

- CSV is produced from the ledger query service output — identical filters,
  identical rows, identical totals as the screen (export-consistency tested).
- Cell values that could be interpreted as formulas (`=`, `+`, `-`, `@`
  prefixes) are escaped against CSV formula injection.
- The legacy GL export (`app/api/general-ledger/export/route.js`) was aligned
  with the screen's mirror-exclusion rule (`transactionId: null`), fixing the
  historical double-count defect P5-I01.

## UI

`app/general-ledger-v2/page.js` (client component): business summary with
totals and balanced indicator, account drill-down with running balances and
pagination, date/branch filters, hierarchy toggle, CSV export. It renders only
what the APIs return — no client-side accounting math.

The legacy journal-entries UI remains unchanged in Phase 5; canonical data is
available through the new APIs, and the full UI replacement is scheduled for
the cutover stage (flag-gated).

## Audit

- Rebuilds: `acctv2.ledger.rebuild` (version, rows, months, reason).
- Reconciliations: `acctv2.ledger.reconciliation` (status, counts, findings
  sample).
- Reversals: full engine audit trail (event registry, approvals, posting) plus
  the reversal linkage in the journal rows themselves.
- Exports run under the export permission and inherit request/correlation ids.

## Observability

Structured logs and metrics via `accountingLogger`: query durations, rebuild
outcomes, reconciliation status and severity counts. Errors return typed codes
without leaking internals; correlation ids flow end to end.

## Feature flags

| Flag | Effect |
| --- | --- |
| `accountingV2LedgerProjection` | Summaries may consult the projection cache (authoritative path is always available regardless) |
| `accountingV2LedgerIntegrityMonitoring` | Scheduled integrity monitoring surfaces findings |
