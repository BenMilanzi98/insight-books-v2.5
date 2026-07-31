# Accounting Flow Inventory

## Canonical write path

`postAccountingTransaction` conceptual API → `lib/accountingV2/engine/postingEngine.js` (`executePosting` / `previewPosting`).

Pipeline: validate tenant/business/period/accounts/balance → claim event (idempotency) → allocate journal number → persist posted journal + lines → audit + outbox → return existing result on replay.

## Read path (authoritative)

Posted journal lines → `ledgerQueryService` → trial balance / financial statements (`lib/accountingV2/reporting/*`).

## Operational sources (must post once)

| Source | Expected posting purpose | Status |
|---|---|---|
| Invoice issue | INVOICE_ISSUANCE | PARTIAL (legacy adapters still present) |
| Customer payment | CUSTOMER_PAYMENT | PARTIAL |
| POS sale | SALE_REVENUE / SALE_COGS | PARTIAL |
| Supplier bill | SUPPLIER_BILL | PARTIAL |
| Supplier payment | SUPPLIER_PAYMENT | PARTIAL |
| Expense | EXPENSE | PARTIAL |
| Payroll run | PAYROLL_RUN | PARTIAL |
| Asset acquisition / depreciation / disposal | ASSET_* | PARTIAL |
| Opening balance / stock | OPENING_* | PARTIAL |
| Bank adjustment | BANK_ADJUSTMENT | Via bank reconciliation adapter |
| Equity contribution / dividend | EQUITY_* | Via equity management |
| Year-end close | CLOSE / RE | Via accounting-close |
| MRA EIS accept / receipt | **NONE** | Controls encode no GL/stock from EIS |

## Forbidden paths still in repo

- Direct mutation of report totals / TB plug
- Silent edit of posted journals
- `MAX+1` numbering (V2 uses allocated sequence)
- Dual post via legacy + V2 for same source (migration risk)

## Classification

Posting engine core: **COMPLETE_REQUIRES_TESTING**  
Full operational cutover of every source: **PARTIALLY_IMPLEMENTED**  
Legacy report stack: **DUPLICATED**
