# Reversal Repair

Audit targets (Phase 5 rules JRN-105/106 + investigation): reversals missing
their original link, multiple reversals of one journal (`DUPLICATE_REVERSAL`,
CRITICAL), incomplete reversals, wrong accounts/amounts/dates/business, source
state not updated, reversals excluded from or double-counted in reports,
reversals into closed periods without authorization.

## Permitted repairs

| Defect | Repair |
|---|---|
| Reversal↔original link missing (proven) | `METADATA_ONLY_REPAIR` — whitelisted `originalJournalId` / `reversedByJournalId` / `reversalStatus` fields. |
| Duplicate reversal (economic effect reversed twice) | `DUPLICATE_EFFECT_REPAIR` — reverse the surplus reversal; all journals preserved. |
| Incomplete/partial reversal | `AMOUNT_ADJUSTMENT_REPAIR` — post exactly the proven remaining amount. |
| Invalid reversal (should never have been reversed) | `REVERSAL_REPAIR` — reverse the invalid reversal, restoring the original effect. |
| Source state disagrees with reversal | `SOURCE_STATUS_REPAIR`. |
| Reversal handled wrongly only in reports/projection | `REPORT_ONLY_REPAIR` / `PROJECTION_REBUILD` — no journal. |
| Unresolved partial reversal | Exception, flagged for Phase 7 disclosure. |

Neither original nor reversal journals are ever deleted. The Phase 5 GL query
layer already nets linked reversal pairs correctly; repairing the LINK (metadata)
is what fixes most report symptoms — another reason not to post new journals for
linkage defects.
