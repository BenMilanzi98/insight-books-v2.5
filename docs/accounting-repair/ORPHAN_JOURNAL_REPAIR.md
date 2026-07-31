# Orphan Journal Repair

Detection `P6-ORPH-001`: posted journal entries with no `transactionId`, no
`sourceType`/`sourceId`, whose `entryType` is not a legitimate sourceless
classification (`Adjustment`, `Opening`, `OpeningBalance`, `Reversal`) and which
are not V2 engine journals. Confidence is `MEDIUM_CONFIDENCE` — classification
is a review decision.

## Investigation outcomes and repairs

| Classification | Repair |
|---|---|
| Source exists, link missing (proven by unique reference/amount/date) | `SOURCE_LINK_REPAIR` — metadata link; journal preserved. |
| Legitimate manual / opening / adjustment / migration journal | `METADATA_ONLY_REPAIR` — set the proven classification and reason metadata. |
| Source deleted incorrectly | Restore/relink source relationship (metadata), escalate the deletion separately. |
| Invalid orphan (no economic basis) | `REVERSAL_REPAIR` — authorized reversal; the orphan is never deleted. |
| Duplicate of another journal | Reclassify the anomaly as `DUPLICATE_JOURNAL` → `DUPLICATE_EFFECT_REPAIR`. |
| Unsupported historical entry, evidence unavailable | `ACCEPTED_EXCEPTION` with disclosure. |

Linking requires proof — unique source reference, exact business, exact amount,
matching account structure, matching dates or audit events. Description
similarity alone is `LOW_CONFIDENCE` and cannot be approved.
