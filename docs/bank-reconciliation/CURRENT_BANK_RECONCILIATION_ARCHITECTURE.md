# Current Bank Reconciliation Architecture (pre / during Phase 10)

## Verdict

**No production bank-reconciliation engine existed before Phase 10.**  
Banking operations post through Accounting V2; statement matching and recon sessions are greenfield.

## What already exists

```
PaymentAccount (Bank / Mobile Money / …)
  └── coaAccountId → Account (CoA cash/bank asset)
        └── Posted JournalEntryLine (architectureVersion = ACCOUNTING_V2)

Banking adapters
  ├── BANK_CHARGE_POSTED
  ├── INTEREST_INCOME_POSTED
  └── bank transfer (remainingAdapters)

Period close
  └── BANK_RECONCILIATION_REVIEWED (MANUAL checklist task)
```

## What was missing (Phase 10 scope)

- Statement file import (CSV / XLSX / OFX) and import profiles  
- Statement row evidence store (immutable external facts)  
- Matching engine (1:1, 1:N, N:1, partial, controlled N:N)  
- Reconciliation session lifecycle (draft → review → complete → snapshot → reopen)  
- Outstanding items / deposits in transit  
- Adjustment posting via Posting Engine from the recon workspace  
- Live period-close feed for `BANK_RECONCILIATION_REVIEWED`  
- Banking / Bank Reconciliation UI routes  

## Authority rules (locked)

1. **Bank master** = reconcilable `PaymentAccount` with linked CoA — not Prisma `BankAccount`.  
2. Statement rows are **external evidence only**; matches never mutate posted JE lines.  
3. Adjustments only via `executePosting` / banking adapters.  
4. GL candidates = posted V2 `JournalEntryLine` on the bank CoA.  
5. No plug journals to force a zero difference.

## Confusion guardrails

| Route / concept | Is it bank recon? |
|---|---|
| GL ledger reconciliation APIs | No |
| Report reconciliation | No |
| Payment account transfers | Operational banking, not statement recon |
| Phase 10 `/api/bank-reconciliation/**` | Yes |

## Target package layout

```
lib/bankReconciliation/
  domain/           enums, signed amounts, calculation
  application/      config, import, match, complete, period-close feed
  infrastructure/   parsers, file security
  permissions.js
app/api/bank-reconciliation/**
app/bank-reconciliation/**
docs/bank-reconciliation/**
```
