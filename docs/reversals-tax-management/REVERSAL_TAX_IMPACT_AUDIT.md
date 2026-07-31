# Reversal Tax Impact Audit

## Today
- Sale/invoice reverse restores inventory and reverses V2 journals including tax-suffixed sources (-tax)
- tax-types UI has reversed-taxes list + export APIs
- No TaxTransaction subledger; tax impact is inferred from journals / SaleItemTax

## Gaps
- No filed-period amendment path when tax period closed/filed
- Impact preview does not always surface tax line GL preview from previewReversal
- Settlement payments reversed via document reverse paths inconsistently

## Wave 3+ hooks
Filed-tax-period → amendment / manual-review. Opposite TaxTransaction rows once when subledger lands.
