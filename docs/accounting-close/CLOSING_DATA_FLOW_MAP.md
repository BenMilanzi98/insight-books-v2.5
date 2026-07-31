# Closing Data Flow Map

## Period-end close (existing + retained)

```
Operational modules complete
  → Period Close Run (Phase 8)
  → Checklist (bank, AR, AP, inventory, payroll, assets, loans, tax, equity tasks)
  → Period snapshots
  → Period status CLOSED
  → Normal postings rejected for that period
```

Temporary IS accounts are **not** zeroed monthly (unless future policy flag — not default).

## Year-end close (Phase 12 target)

```
All periods CLOSED (or approved final state)
  → Year-End Close Run (versioned)
  → Close Readiness Engine (GL/TB/bank/subledgers/equity/config)
  → YE Adjustment Journals (Posting Engine, type YEA-ADJ)
  → Adjusted Trial Balance (must balance)
  → Final FS validation
  → Closing Journal Batch preview + checksum
  → Approval (stale if data changes)
  → Post via Posting Engine (YEA-CLS / YEA-TRF / YEA-DRW)
  → Post-Closing Trial Balance (must balance; temps = 0)
  → Annual snapshots + Close Pack
  → Financial Year CLOSED (atomic)
  → Next FY create/activate (Phase 8 calendar)
  → Opening reporting balances = post-close permanent balances (no OB journal on continuous GL)
```

## Profit transfer (Income Summary method)

```
Dr Revenue / Other Income → Cr Income Summary
Dr Income Summary → Cr COS / Expense / Tax / Other Expense
Dr/Cr Income Summary → Cr/Dr Retained Earnings (or Owner/Partner Capital)
Drawings: Dr Owner/Partner Capital → Cr Drawings (not via IS)
```

## Carry-forward (continuous GL — default)

```
Permanent accounts retain cumulative JE balances
Next year opening reports = sum(JE lines) before new FY start
NO opening journal for BS accounts
```

## Reopen / reclose

```
CLOSED → reopen request → impact analysis → approval
  → optional Closing Journal reversal (YEA-REV) — never delete originals
  → corrections
  → new Close Run version
  → new Closing Batch + PCTB + snapshots
  → reclose (prior version SUPERSEDED)
```

## Forbidden paths

- Reset account balances in DB
- Close BS accounts to zero
- Dual CYE (calculated + stored)
- Dual RE transfer
- Capital/drawings/dividends via Revenue/Expense close
- Closing journals outside Posting Engine
- Plug Suspense to force close
