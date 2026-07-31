# Adjustment Journal Framework

Implementation: shared with the manual-journal service
(`lib/accountingV2/application/manualJournalService.js`, `entryType:
'Adjustment'`) + the `ADJUSTMENT_JOURNAL` template and
`ADJUSTMENT_POSTED` event type.

## Categories

`Reclassification`, `Accrual`, `Prepayment`, `Correction`, `TaxAdjustment`,
`InventoryAdjustment`, `AuditAdjustment`, `PriorPeriodAdjustment`,
`OpeningBalanceCorrection` — stored in `JournalEntry.adjustmentCategory`.

## Mandatory fields

Every adjustment requires: `adjustmentReason` (free-text reason, refused when
blank), `adjustmentCategory`, `relatedJournalId` or source reference where
applicable, supporting attachment references where policy requires,
approval (always — adjustments cannot self-post), posting date, resolved
period, and the acting user. All are validated by the source validator and
persisted on the journal for the audit trail.

## Rules

- Same lifecycle as manual journals (`DRAFT → PENDING_APPROVAL → APPROVED →
  POSTED`), same separation of duties, same immutability after posting.
- Journal numbers use the `ADJ-YYYY-NNNNNN` scope.
- Prior-period adjustments additionally require the backdating permission and
  pass the period resolver's authorized-backdating path; closed periods still
  refuse unless the period rules allow the authorized adjustment flow.
- Adjustments never silently modify their related source or journal — the
  related journal is linked (`relatedJournalId`), not edited.
- Duplicate adjustments for the same identity are caught by the standard
  idempotency layer.

Adjustments are corrective instruments with full traceability; they are not a
mechanism to hide unresolved errors — the reason, category, related-record
link and approver are all mandatory and audited.

Tests: adjustment cases in `test/accountingV2.postingEngine.test.js`
(valid adjustment, missing reason, missing approval, closed period,
related-journal linkage, immutability).
