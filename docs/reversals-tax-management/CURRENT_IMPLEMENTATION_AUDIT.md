# Current Implementation Audit

## Reversals
| Layer | Evidence | Status |
|-------|----------|--------|
| V2 GL reverse | `lib/accountingV2/application/journalReversalService.js` | Production-grade KEEP |
| Source adapter | `lib/accountingV2/application/reverseSourceJournals.js` | KEEP/EXTEND (auto-grants journal.reverse) |
| Document orchestrator | `lib/transactionReversalService.js` | Working hybrid EXTEND |
| Execute API | `app/api/transactions/reverse/route.js` | Immediate execute, no approval |
| List API | `app/api/transactions/reversals/route.js` | Aggregates isReversal rows; paging in-memory |
| UI | `app/transactions/reversals/page.js` + `components/TransactionReversal/*` | History + modal EXTEND |
| Aggregate model | None (`ReversalAudit` @@ignore stub) | Missing |

## Tax
| Layer | Evidence | Status |
|-------|----------|--------|
| Catalogue UI | `app/tax-types/page.js` | Canonical live CRUD |
| Hub UI | `app/tax-management/page.js`, `app/tax/page.js` | Near-duplicates; orphaned from primary nav |
| Accounts UI | `app/tax-accounts/page.js` | Live balances + settle |
| Rules UI | `app/tax-rules/page.js` | Client mock only |
| Model | `TaxType` + ProductTax/SaleItemTax | No periods/returns/credits |
| Settle | `POST /api/tax/settle` → V2 TAX_SETTLEMENT | Works; tax.settle unused |
| Nav | Sidebar "Tax Management" → `/tax-types` | Misaligned label vs hub |

## Classification summary
V2 journal reverse KEEP. Document reverse EXTEND into engine façade. TaxType KEEP. Hub routes MIGRATE. Periods/returns/credits REIMPLEMENT.
