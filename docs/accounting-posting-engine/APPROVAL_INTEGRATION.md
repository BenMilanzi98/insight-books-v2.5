# Approval Integration

Implementation: `lib/accountingV2/engine/approvalValidation.js`, consumed by
the validation pipeline and the application services.

## Context

Phase 1 found no dedicated legacy approval framework for accounting writes.
Phase 4 therefore implements the engine's native approval contract, designed
so a future workflow system can plug in behind the same interface.

## Requirement resolution

`resolveApprovalRequirement({ eventType, template, amount, context, periodStatus })`
determines whether approval is required from:

- Template approval rules (manual journals, adjustments and opening balances
  always require approval).
- Amount thresholds where configured on the template.
- Period status (backdated/reopened-period postings require approval).
- Business configuration hooks (extensible per tenant).

## Validation

`validateApproval` enforces, against **stored** state (never frontend claims):

- An approval record/reference exists when required.
- The approval belongs to the same source and the same business.
- The approval is in approved status and not expired/superseded.
- The approver holds the approving permission (`journal.approve`,
  `openingBalances.approve`, …).
- **Separation of duties**: the initiator cannot approve their own journal or
  batch — `ApprovalInvalidError` (tested for both manual journals and opening
  balance batches).
- Approval details (amount, date window) match the posting command.

## Workflow integration

The application services own the human workflow:

- `manualJournalService.js`: `DRAFT → PENDING_APPROVAL → APPROVED` via
  `submit`/`approve`/`reject` endpoints; `approvedById`/`approvedAt` recorded
  on the journal; the engine re-validates the stored approval at posting time.
- `openingBalanceService.js`: same shape on `AcctV2OpeningBalanceBatch`.

The engine never trusts an `approved` flag in the request body; posting an
unapproved draft fails with `SourceNotPostableError` even if the caller holds
posting permission.
