# Operational Module Date Controls

Phase 8 provides the guards; full operational posting integration is Phase 9.

## Guards available to every module

| Guard | Use |
| --- | --- |
| `resolvePeriodV2` | inside the posting pipeline (throwing) |
| `validatePostingDate` | non-throwing pre-check for forms, imports, webhooks, background jobs |
| `POST /api/accounting-v2/periods/resolve` | HTTP dry-run for UI date pickers |
| Typed errors (`ClosedAccountingPeriodError`, `InvalidPostingDateError`, `InvalidAccountingPeriodError`) | consistent, safe user messaging |

## Module coverage path

All V2 postings flow through the central Posting Engine, so invoice, payment,
credit note, refund, supplier bill/payment/credit, expense, payroll,
inventory, COGS, stock adjustment, bank, fixed-asset, depreciation, loan,
tax, equity, manual/adjustment journal, opening balance and reversal events
inherit period controls automatically once their module posts through the
engine (Phase 9 work). Modules still posting through legacy paths remain
governed by the legacy closed-period check until their flag is enabled —
tracked in PHASE_9_READINESS.md.

## Imports, webhooks, background jobs

These are ordinary posting sources: they carry `sourceModule`/`eventType`
into the Posting Command, so period controls, backdating rules and audit
apply identically. Hidden backdating through import payloads is impossible —
the requested posting date always passes `evaluatePostingDate`.
