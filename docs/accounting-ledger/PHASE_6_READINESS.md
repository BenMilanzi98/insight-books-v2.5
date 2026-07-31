# Phase 6 Readiness — Historical Repair Inputs

Phase 5 gives Phase 6 (historical data repair) a measurable, categorized
inventory of every known defect class, with detection tooling already built.
Nothing was repaired in Phase 5 — canonical rules were chosen so that
historical report figures did not change.

## Repair inventory by category

| Category | Detection | Rule | Repair approach for Phase 6 |
| --- | --- | --- | --- |
| Header-amount journals (amounts on header floats, zero lines) | `findHeaderOnlyJournals` | JRN-104 | Reconstruct proper lines as V2 adjustment/repair journals per document; never mutate the legacy rows |
| Unbalanced posted journals | Integrity checks | JRN-102 | Correcting journals per case, with evidence |
| Duplicate postings (TOCTOU-era) | Event registry + source-lineage queries | JRN-108 / GL-117 | Reversal of the duplicate side, keeping lineage |
| Authority conflicts (mirror journal disagrees with its transaction) | `findAuthorityConflicts` | GL-117 | Transaction side is authoritative; correcting journal for any residual difference |
| Stored `Account.balance` drift | Reconciliation | GL-111 | Retire/recompute the cache once repairs land (cache retirement is a Phase 6 deliverable) |
| Direct activity on header accounts | Summary anomalies | GL-110 | Reclassify to posting accounts via adjustment journals |
| Missing dimensions on legacy lines | `UNASSIGNED` bucket | — | Optional enrichment via metadata (never invented amounts) |
| Status-casing drift (`posted` vs `Posted`) | JRN-106 findings | JRN-106 | Data normalization pass (non-financial column) |
| Missing/ambiguous source links | Lineage `lineageReliable:false` | JRN-108 | Backfill source references where documents can be matched with evidence |

## Tools Phase 6 can use as-is

- Reconciliation API/report for before/after proof of every repair batch.
- Adjustment journal framework (Phase 4) — categorized, approved, immutable
  repair journals with reasons and lineage.
- V2 reversal workflow for duplicate/erroneous V2 postings.
- Ledger projection rebuild to refresh summaries after repair batches.
- Database triggers guarantee repairs cannot mutate posted history — repairs
  must be new journals, which is exactly the Phase 6 posture.

## Constraints binding on Phase 6

- Never edit posted rows (enforced at the database for V2; policy + Phase 6
  trigger extension for legacy).
- Every repair carries evidence, approval and audit lineage.
- Legacy `LEGACY_V1` update-trigger protection should land together with the
  account-merge flow rework (the one legitimate legacy line-update path).
