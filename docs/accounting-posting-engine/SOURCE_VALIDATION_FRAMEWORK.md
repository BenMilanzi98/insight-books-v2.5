# Source Validation Framework

Implementation: `lib/accountingV2/engine/sourceValidation.js`.

## Design

Event types register typed validators through
`registerSourceValidator(eventType, validator)`. The pipeline calls
`validateSource(db, context, command)` which resolves the validator for the
command's event type and returns the loaded source row plus derived values for
draft generation. Missing validators are an explicit
`PostingTemplateValidationError` — no event can post without a registered
source contract.

Every validator enforces the common contract:

- Source exists (`SourceNotFoundError`).
- Source belongs to the command's business (cross-tenant refused).
- Source is in a postable status (`SourceNotPostableError`) — not cancelled,
  not deleted, not already posted for the same event.
- Source values (totals, currency, dates) match the command; internal totals
  are consistent.
- Required dimensions exist (customer/supplier/owner/bank/etc. per template).
- Required supporting evidence exists where policy demands it (opening
  balances).

## Pilot validators implemented

| Validator | Event type | Key rules |
| --- | --- | --- |
| Manual journal | `MANUAL_JOURNAL_POSTED` | V2 draft `JournalEntry` exists, business-scoped, status `Approved`, ≥ 2 lines, architecture `ACCOUNTING_V2` |
| Adjustment journal | `ADJUSTMENT_POSTED` | As manual journal + reason and category present |
| Opening balance | `OPENING_BALANCE_POSTED` | `AcctV2OpeningBalanceBatch` exists, `APPROVED`, evidence reference present, balanced lines |
| Customer invoice (shadow only) | `INVOICE_POSTED` | Invoice exists, business-scoped, not draft/void, totals parse as decimals |

The remaining operational validators (payments, expenses, payroll, inventory,
loans, capital, …) are Phase 9 work; their template contracts are already
declared in `lib/accountingV2/templates/definitions.js`.
