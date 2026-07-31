# Excel Exports

`exportReportToExcel` in `reportExportService.js` (exceljs), served by
`GET /api/accounting-v2/reports/export?format=excel`. CSV
(`exportReportToCsv`) shares the same rules.

## Same-engine guarantee

Excel and CSV consume the identical completed envelope as the screen and PDF.
Export tests assert that the workbook's numeric cells and the CSV rows carry
exactly the envelope's amounts.

## Workbook structure

- **Report sheet** — code, label, account codes, account names, amount,
  comparative, variance; hierarchy indentation; total rows bolded.
- **Scope sheet** — business, report type, window, currency, filters,
  definition version, generated at/by.
- **Integrity sheet** — status plus every warning code, severity and message.
- Account breakdown rows appear beneath their lines when
  `includeAccountDetails` is set; journal drill-down sheets are available
  through the drill-down API for targeted export.

## Safety

- **Numeric cells** for all amounts (converted from exact minor units), never
  text — no string arithmetic downstream.
- **Formula-injection protection**: every text cell passes `sanitizeCell`,
  which prefixes `'` to values starting with `=`, `+`, `-`, `@`, tab or CR
  (tested with a malicious account name).
- No uncontrolled formulas are written.
- CSV output quotes and escapes per RFC 4180 and applies the same
  sanitization.

Every export writes an audit event with format, filters hash and user.
