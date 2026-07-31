# Current Year Earnings — Year-End Treatment

## Selected model: MODEL A — Calculated reporting line

During the year, Current Year Earnings on the Statement of Financial Position is
**derived** from posted Income Statement activity (Revenue − Expenses ± Other).

It is **not** an independently posted running control balance that is also
added again at year end.

### Year-end

1. Closing Journals close temporary IS accounts (via Income Summary or direct method).
2. Net profit or loss transfers **once** to Retained Earnings (or Owner/Partner Capital).
3. That transfer **is** the CYE clearance for the closed year.
4. Post-closing presentation: CYE for the closed year is zero / not shown as a separate posted balance.

### Forbidden

- Calculating CYE on reports **and** posting a separate CYE control transfer for the same profit.
- Closing a CYE control account **and** transferring Income Summary to RE for the same amount.
- Dual-counting on Statement of Changes in Equity.

### Configuration

`CloseV2Configuration.metadata.cyeModel = MODEL_A_CALCULATED_REPORTING_LINE`
