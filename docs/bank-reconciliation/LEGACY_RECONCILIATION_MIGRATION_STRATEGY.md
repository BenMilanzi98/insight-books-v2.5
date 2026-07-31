# Legacy Reconciliation Migration Strategy

## Inventory

| Artifact | Finding |
|---|---|
| Statement / match / recon tables | **None** before Phase 10 |
| Cleared flags on payments | Not a reliable recon evidence trail |
| Prisma `BankAccount` | Unused as operational bank master |
| GL “reconciliation” APIs | Integrity checks — not statement recon |

## Strategy

1. **Do not invent** historical statement rows from cleared flags.  
2. Start Phase 10 sessions from the first imported statement after cutover.  
3. Prior uncleared book items appear as outstanding / DIT via remaining unmatched JE lines.  
4. Optional: operators may seed opening statement balances manually on the first recon.  
5. Keep `Transaction` archive untouched (fresh-books policy).

## Readiness artifact

`artifacts/bank-reconciliation/bank-account-readiness.csv` — inventory PaymentAccounts with CoA links (no sensitive account numbers).
