# Audit and Traceability

Implementation: `lib/accountingV2/infrastructure/auditTrail.js` (Phase 2
`AcctV2AuditLog`, append-only) + `AcctV2PostingAttempt` rows + structured logs
(`observability/accountingLogger.js`).

## What is recorded

Every posting flow writes audit actions such as `acctv2.posting.posted`,
`acctv2.posting.failed`, `acctv2.posting.replayed`, `acctv2.shadow.compared`,
plus workflow actions from the application services (`journal.created`,
`journal.submitted`, `journal.approved`, `journal.rejected`,
`openingBalance.*`). Each record carries:

- Event identity (registry ID, idempotency key) and source reference
- Business, user (initiator/approver/poster), approval reference
- Template ID + version, architecture version, posting mode, feature-flag
  state at decision time
- Account mappings used, resolved period, validation outcome
- Journal number and line summary (accounts + amounts)
- Idempotent-replay and duplicate-attempt markers
- Request ID, correlation ID, timestamps
- Reason and category for manual/adjustment journals
- IP/user-agent where the route guard captured them

`AcctV2PostingAttempt` additionally gives a per-attempt trace: attempt number,
status (`SUCCEEDED`, `FAILED_RETRYABLE`, `FAILED_FATAL`), failure code,
retryable flag, duration.

## Properties

- **Append-only**: no update/delete path exists in ordinary workflows; the
  audit writer only inserts.
- **No secrets**: failure messages are sanitized before persistence; stack
  traces and connection details never reach audit rows or API responses.
- **Success records only on commit**: audit rows for a posting are written
  inside the posting transaction, so a rollback removes the success record and
  the durable failure is recorded through the separate safe path.
- **End-to-end trace**: from any posted journal you can walk journal →
  `accountingEventId` → registry row → attempts → audit records → outbox
  events, all sharing request/correlation IDs.
