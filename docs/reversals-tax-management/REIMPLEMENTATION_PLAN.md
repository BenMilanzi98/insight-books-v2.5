# Reimplementation Plan

Mirrors the approved Cursor plan `reversals_tax_management_a22678dc`.

## Locked defaults
- Phased waves with gates after Wave 0, Reversal foundation, Tax hub foundation
- Period policy: `REVERSE_IN_CURRENT_OPEN_PERIOD` with cross-period disclosure
- Redirects only after nav/guards updated
- `/tax-types` → `/tax-management`; `/tax-accounts` → `/tax-management/accounts`
- `taxManagement.*` aliases map to existing `tax.*` during transition

## Architecture

Document reverse request → eligibility (`transactionReversalService`) → TransactionReversal register (Wave 2) → `reverseSourceJournals` / `reverseJournal` (V2 only) → domain side effects (AR/AP/stock/tax).

Tax hub: `/tax-management` dashboard + nested tax-codes, accounts, and later periods/returns/payments/reports.

## Non-changes
No original journal deletion, no typed tax closings, no second posting engine, no abrupt route deletion before redirects.
