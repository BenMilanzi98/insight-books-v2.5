# Task 7 Report: Reversal coverage for Invoice-Revenue

## Status
- Completed with a minimal payment-reversal extension.

## Changes
- Updated `lib/transactionReversalService.js` so payment reversal passes `['Payment', 'Invoice-Revenue']` to `reverseSourceJournals`.
- Added `test/paymentReversalSourceTypes.test.js` to statically verify payment reversal includes `Invoice-Revenue` in the reversed source types list.

## Verification
- RED: `npm test -- test/paymentReversalSourceTypes.test.js` failed before the code change because only `['Payment']` was present.
- GREEN: `npm test -- test/paymentReversalSourceTypes.test.js test/invoiceRevenueRecognitionAdapter.test.js` passed after the change.
- Lints: `ReadLints` reported no issues in the edited files.

## Concerns
- Coverage is intentionally narrow and static, matching the task brief; it proves the payment reversal config includes `Invoice-Revenue` but does not exercise full DB-backed journal reversal flow.

## Commits
- None
