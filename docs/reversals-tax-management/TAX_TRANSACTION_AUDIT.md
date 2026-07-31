# Tax Transaction Audit

## Exists
SaleItemTax snapshots; journal lines on tax liability/asset; settle posts TAX_SETTLEMENT.

## Missing
Immutable TaxTransaction subledger derived from posted evidence; accumulated tax = subledger sum; reversal opposite rows.

## Classification
REIMPLEMENT subledger in Wave 3. Until then, reports continue from journals + SaleItemTax.
