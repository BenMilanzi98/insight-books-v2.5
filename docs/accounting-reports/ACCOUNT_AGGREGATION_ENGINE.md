# Account Aggregation Engine

Aggregation is deterministic and database-side.

## Pipeline (per report line)

1. **Resolve mapped accounts** — `assignAccountsToLines` over the business
   ledger summary (definition order, first match, single assignment).
2. **Validate business ownership** — the ledger summary only loads accounts
   `where { tenantId: context.businessId }`; canonical line queries carry the
   same tenant predicate.
3. **Resolve aliases** — merged-away accounts roll up to survivors in the
   ledger service (`buildSurvivorResolver`); one journal line contributes once.
4. **Exclude parent/child double counting** — header accounts carry no
   amounts; hierarchy rollups are presentation-only (`getLedgerHierarchy`).
5. **Query canonical GL values** — `getCanonicalAccountTotals` groups
   debit/credit sums per account database-side (`groupBy`), chunked to bound
   parameter counts; no N+1 per-line queries and no fan-out joins (line stores
   are queried by header-id sets, so join multiplication — REP-033 — cannot
   occur).
6. **Apply the date basis** — period movement for activity statements,
   cumulative as-of closing for position statements (`drillDownBasis` records
   which, so drill-down uses the same basis).
7. **Apply normal-balance presentation** — `resolveNormalBalance` precedence:
   CoA V2 → legacy column → category default → type default → debit fallback
   with warning (REP-034 surfaced by reconciliation).
8. **Apply the report display sign** — credit-normal statement lines carry
   `displaySign: -1` so revenue/liability/equity display positive.
9. **Return account-level breakdown** — every line embeds per-account amounts
   for expansion and drill-down.
10. **Record metadata** — `mappingRule` on each line; assisted mappings and
    unmapped accounts disclosed on the envelope.

## Arithmetic

Integer minor units end to end (`parseDecimalToMinor` at ingestion,
`minorToDecimalString` at presentation). No floats in totals; no premature
rounding — line values are exact and totals are sums of exact values.

Aggregation never reads operational tables; operational data appears only as
aging detail in subledger reports, reconciled against GL control accounts.
