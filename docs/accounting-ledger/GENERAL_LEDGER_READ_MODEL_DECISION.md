# General Ledger Read Model Decision

Phase 5 had to choose between (A) computing GL views directly from journal
lines with indexed queries, and (B) maintaining a stored, versioned,
rebuildable GL read model.

## Decision: A as authority, plus a non-authoritative monthly summary cache

**Direct indexed canonical queries are the authoritative read path for every
ledger figure.** A monthly per-account summary projection
(`AcctV2LedgerBalance`) exists purely as an accelerator and drift sentinel; it
is never consulted as truth and every figure it serves can be (and is)
revalidated against the canonical source.

## Rationale

| Consideration | Assessment |
| --- | --- |
| Correctness risk | A stored read model that serves as truth reintroduces exactly the failure Phase 1 documented: `Account.balance` drifting from journal lines. Direct queries cannot drift. |
| Data volume | Current tenants' posted-line volumes are served comfortably by DB-side `groupBy` over the Phase 4/5 indexes (`[tenantId, sourceType, sourceId]`, `[tenantId, postingDate]`, line `[accountId]`, `[tenantId, entryType]`). |
| Dual-ledger reality | Until legacy write paths are retired (Phase 9), any stored model must ingest two ledgers; keeping authority in the query layer keeps the authority rule in one module. |
| Reporting speed | Monthly summaries (trial-balance-shaped queries) are the hot path; the projection accelerates those without owning any number. |

## Projection design (`AcctV2LedgerBalance`)

- Grain: tenant × account × calendar month (`periodKey` `YYYY-MM`) × currency,
  storing raw debit, credit, base debit, base credit and line count.
- **Versioned**: rows carry `projectionVersion`. A rebuild writes the complete
  new version, validates it against canonical totals, and only then removes
  the old version — a failed rebuild leaves the previous projection intact.
- **Rebuildable at any time** from journal lines alone
  (`ledgerRebuildService.js`), per business; dry-run supported.
- **Non-authoritative**: unique index prevents duplicate cells; GL-114
  reconciliation detects staleness; the flag
  `accountingV2LedgerProjection` gates whether summaries may consult it.

## Consistency contract

- Authoritative reads: always canonical (strong consistency).
- Projection: eventually consistent by explicit rebuild; staleness is
  measurable (`projectedAt`, version) and monitored, never hidden.

## Revisit triggers

Move summary authority into a maintained read model only if (a) canonical
`groupBy` latency on the largest tenant exceeds interactive budgets with
correct indexes, and (b) Phase 9 has retired legacy write paths so a single
posting pipeline can update the model transactionally.
