# Date Policy Framework

`lib/accountingV2/periods/datePolicy.js` — `DATE_KINDS`.

| Date | Meaning | Role in period assignment |
| --- | --- | --- |
| TRANSACTION_DATE | When the business event economically occurred (invoice issue, expense incurred, goods receipt, payroll effective date) | **Preserved verbatim**; never determines the period |
| POSTING_DATE | When the accounting effect enters the General Ledger | **The only date that determines financial year and period** |
| DOCUMENT_DATE | Date printed on the source document | Preserved where applicable; informational |
| DUE_DATE | When payment falls due | Aging only — never period assignment |
| CREATED_DATE | System row timestamp | Never a substitute for accounting dates |
| SETTLEMENT_DATE | When payment/settlement occurred | May create a *separate* accounting event with its own posting date |

## Rules

1. The Posting Command (Phase 4) carries `transactionDate` and
   `requestedPostingDate` separately; journals store both
   (`transactionDate`, `entryDate`/posting date).
2. `resolvePeriodV2` resolves the period exclusively from the posting date.
   Requested posting dates default to the transaction date when omitted, then
   pass the full policy evaluation.
3. `evaluatePostingDate` normalizes all dates to date-only UTC values in the
   business timezone before comparisons — no raw server-UTC comparisons.
4. There is no generic `date` field in the V2 posting path.
