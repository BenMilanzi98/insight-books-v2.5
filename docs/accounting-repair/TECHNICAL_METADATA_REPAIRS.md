# Technical Metadata Repairs

Metadata repairs (`METADATA_ONLY_REPAIR`, `SOURCE_LINK_REPAIR`,
`SOURCE_STATUS_REPAIR`) correct non-financial fields where the economic meaning
is unchanged. Implementation: `executeMetadataRepair` in
`repairExecutionService.js`.

## Whitelist (structural, server-side)

`METADATA_FIELD_WHITELIST` defines the ONLY repairable fields per target model:

- `JournalEntry`: `sourceType`, `sourceId`, `sourceNumber`,
  `accountingPeriodId`, `referenceNumber`, `description`, `originalJournalId`,
  `reversedByJournalId`, `reversalStatus`.
- `Transaction`: `sourceType`, `sourceId`, `reference`, `branchId`, `description`.
- `SupplierBill` / `SupplierPayment`: `journalEntryId`.

Accounts, debit/credit amounts, currencies and posted statuses do not appear in
any whitelist — a command naming them is rejected at `buildRepairCommand` with
"field is not metadata-repairable". Unknown target models are rejected outright.
Mass assignment is impossible by construction.

## Execution guarantees

- Target must exist and belong to the command's business (cross-business
  targets are refused).
- Previous values of every changed field are captured on the action
  (`previousValues`) before the update; new values stored as `newValues`.
- The field update, action completion and anomaly `REPAIRED` stamp run in one
  transaction; the audit trail records old and new values.
- **Rollback**: `rollbackMetadataRepair` restores the stored previous values,
  marks the action `ROLLED_BACK` (who/when) and moves the anomaly to
  `ROLLED_BACK` — exact-restore is test-covered.

Uncertain values are never populated to satisfy non-null constraints; if the
rightful value is unproven the anomaly stays `EVIDENCE_INCOMPLETE` or becomes an
exception.
