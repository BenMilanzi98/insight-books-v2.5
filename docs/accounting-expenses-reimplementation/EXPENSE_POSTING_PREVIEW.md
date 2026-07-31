# Design Stub — Expense Posting Preview

**Date:** 2026-07-25  
**Engine support:** `previewPosting` in `lib/accountingV2/engine/postingEngine.js`  
**Product status:** Not wired for expenses — GAP-010  
**Tag:** `EXTEND`

## Goal

Before `APPROVED` commit, user/API sees the exact journal that would post: accounts, debits, credits, period, warnings (header account, closed period, missing VAT mapping).

## API sketch

`POST /api/expenses/posting-preview`

Body: expense draft fields (or `expenseId` for existing draft).  
Auth: same as expense update.  
Behaviour:

1. Build the same command as `postExpenseAccounting` / payment preview variant.  
2. Call `previewPosting` (no `AcctV2EventRegistry` insert, no journal persist).  
3. Return `{ lines[], totalDebit, totalCredit, periodId, warnings[], errors[] }`.

## UI

- Panel on expense form: “Accounting preview”.  
- Block Approve CTA when `errors.length > 0`.  
- Warnings for catch-all `5900`, missing supplier AP, tax=0 when tax type set, etc.

## Payment preview

Separate action for settlement: show Dr AP / Cr Bank only — never Dr Expense if recognition exists.

## Acceptance

- Preview twice → identical payload; zero journals.  
- Approve after preview → lines match preview (within tax rounding).  
- TC-UI-01 in test audit.
