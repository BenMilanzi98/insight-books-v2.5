# Duplicate Tax Posting Risk Register

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| R-DT01 | Purpose VAT_* vs fixed 2041/2045 dual track | High | Single purpose↔account map Wave 3 |
| R-DT02 | Settle without tax.settle check | Medium | Wire permission |
| R-DT03 | Missing export creates retry spam | Low | Implement export |
| R-DT04 | No TaxTransaction uniqueness | High | Subledger unique on journalLineId Wave 3 |
