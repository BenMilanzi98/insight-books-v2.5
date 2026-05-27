# Money calculation map

Canonical helpers: [`lib/money.js`](../lib/money.js), [`lib/invoiceTotals.js`](../lib/invoiceTotals.js).

## Invoicing
| File | Role |
|------|------|
| `lib/invoiceTotals.js` | **Canonical** line + header totals (2 dp, cent-safe) |
| `lib/invoiceCalculations.js` | UI formatters + delegates subtotal/tax/total to `invoiceTotals` |
| `app/api/invoices/route.js` | POST create — uses `calculateInvoiceTotals` |
| `app/api/invoices/[id]/route.js` | PUT update — uses `calculateInvoiceTotals` |
| `components/InvoiceModal.js` | Preview — uses `calculateInvoiceTotals` |
| `lib/rentalInvoiceCalc.js` | Rental lines — uses `invoiceTotals` |

## POS / sales
| File | Role |
|------|------|
| `app/api/sales/route.js` | **Canonical** sale totals on POST |
| `lib/productTaxCalculations.js` | Per-line tax (2 dp) |
| `lib/saleItemBaseQuantity.js` | Flexible unit line amounts |
| `app/pos/page.js` | Web cart + checkout payload |

## Expenses
| File | Role |
|------|------|
| `lib/expenseAmounts.js` | **Canonical** gross / outstanding (amount = gross incl. tax component) |
| `lib/expenseGlPosting.js` | GL split base vs tax |
| `app/api/expenses/route.js` | Create / paidAmount |
| `app/api/expenses/partial-payment/route.js` | Partial pay caps |
| `lib/payeExpenseSettlement.js` | PAYE settlement outstanding |

## Purchases
| File | Role |
|------|------|
| `app/api/purchases/orders/route.js` | PO line/header `roundMoney` |
| `app/api/purchases/bills/route.js` | Bill totals |
| `app/api/purchases/payments/route.js` | Allocations |

## GL / CoA
| File | Role |
|------|------|
| `lib/coaMoney.js` | Re-exports `roundMoney`, tolerances |
| `lib/accountingValidation.js` | Journal balance ±tolerance |
| `lib/journalEntryFormatter.js` | Line amount coercion |

## Persistence
Monetary `Float` fields are migrated to `Decimal @db.Decimal(18, 2)` via `prisma/migrations/20260527120000_money_decimal_precision/migration.sql`.
