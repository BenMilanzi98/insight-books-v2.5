# Repair Approval Workflow

Anomaly flow: `DETECTED → UNDER_INVESTIGATION → READY_FOR_REVIEW (proposal) →
APPROVED_FOR_REPAIR | REJECTED → (batch) REPAIRING → REPAIRED → VERIFIED`.

## Approval matrix (`APPROVAL_MATRIX` in the catalogue)

| Repair class | Approver role | Separation of duties | Risk |
|---|---|---|---|
| Metadata / source-status / source-link / report-only / projection rebuild | Senior accountant | not required | LOW |
| Reversal, reclassification, amount adjustment, missing journal, duplicate effect | Finance Manager | required | HIGH |
| Period adjustment | Finance Manager + period controller | required | HIGH |
| Cross-business | Finance Manager + Super Administrator | required | CRITICAL |

## Server-side enforcement

1. **Confidence gate** — `decideRepair` refuses approval below
   `CONFIRMED`/`HIGH_CONFIDENCE`.
2. **Permitted-repair gate** — proposals outside the anomaly type's
   `permittedRepairs` are refused at proposal AND at execution.
3. **Separation of duties (anomaly)** — for classes with
   `separationOfDuties: true`, `executeRepair` refuses execution when
   `anomaly.approvedBy === context.userId` (`ApprovalInvalidError`). The posting
   engine additionally enforces approver ≠ executor for the
   `HISTORICAL_REPAIR_POSTED` event (always-approval event type).
4. **Separation of duties (batch)** — `transitionBatch` refuses
   `READY_FOR_REVIEW → APPROVED` when the approver is the batch requester.
5. **Backup gate** — a batch cannot be approved without a validated
   `backupReference` (see `BACKUP_AND_RESTORE_VALIDATION.md`).
6. **Checksum gate** — batch approval recomputes the action-set checksum; if the
   action set changed after review, approval is refused until re-review.
7. **Permissions** — each API action requires its `accountingRepair.*`
   permission (see `SECURITY_AND_PERMISSIONS.md`).

Approvals, rejections, transitions and executions are all written to the
immutable accounting audit trail with request/correlation ids.
