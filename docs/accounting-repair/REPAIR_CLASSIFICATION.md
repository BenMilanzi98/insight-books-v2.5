# Repair Classification

Twelve approved repair classes (`RepairType` in the catalogue). Nothing else may
modify financial data. Seven classes create journals and post exclusively
through the Phase 4 posting engine (`JOURNAL_CREATING_REPAIRS`); the rest touch
whitelisted metadata, projections or code only.

| Class | Creates journal | What it does | Risk tier |
|---|---|---|---|
| `METADATA_ONLY_REPAIR` | No | Whitelisted non-financial fields (source link, period link, reference, description, reversal linkage). Previous values stored; rollback supported. | LOW |
| `SOURCE_STATUS_REPAIR` | No | Corrects a source's posted/unposted flag based on proven journal authority. | LOW |
| `SOURCE_LINK_REPAIR` | No | Links a proven journal↔source pair (unique reference + exact business/amount/date). Never by description similarity. | LOW |
| `REVERSAL_REPAIR` | Yes | New opposite journal cancels an invalid posting; original preserved. | HIGH |
| `RECLASSIFICATION_REPAIR` | Yes | Amount correct, account wrong: Dr correct account / Cr wrong account. Original untouched. | HIGH |
| `AMOUNT_ADJUSTMENT_REPAIR` | Yes | Known difference posted as a controlled adjustment; original amount never replaced. | HIGH |
| `MISSING_JOURNAL_REPAIR` | Yes | Journal created only from an authoritative, complete source through an approved template. | HIGH |
| `DUPLICATE_EFFECT_REPAIR` | Yes | Authoritative journal preserved; duplicate reversed (never deleted). | HIGH |
| `PERIOD_ADJUSTMENT_REPAIR` | Yes | Reverse-and-repost or prior-period adjustment; a posted journal's period id is never edited. | HIGH |
| `CROSS_BUSINESS_REPAIR` | Yes | Reverse in the wrong business, repost in the rightful one; security review; never a businessId mutation. | CRITICAL |
| `REPORT_ONLY_REPAIR` | No | Fix the report/query/mapping; journals unchanged; before/correct values recorded. | LOW |
| `PROJECTION_REBUILD` | No | Rebuild GL read model from canonical journals; source journals unchanged. | LOW |

## Enforcement points

- `buildRepairCommand` refuses a journal-creating class without a proposed
  journal, and refuses metadata changes outside `METADATA_FIELD_WHITELIST`
  (accounts, amounts and posted-journal statuses are structurally uneditable).
- `executeJournalRepair` refuses to post lines that differ from the approved
  proposal stored on the anomaly (`proposedRepairData`) — the engine posts
  exactly what finance approved, nothing else.
- Repair journals carry `entryType: 'HistoricalRepair'`, journal number prefix
  `HREP-`, template `HISTORICAL_REPAIR`, and full lineage metadata (anomaly,
  batch, repair type/version, original journal/source, reason, approval).
