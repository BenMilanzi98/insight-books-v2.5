# PDF Exports

`exportReportToPdf` in `reportExportService.js` (jsPDF + autotable), served by
`GET /api/accounting-v2/reports/export?format=pdf`.

## Rule zero

The PDF generator **receives a completed report envelope** from
`generateReport` and only formats it. It performs no queries and no
arithmetic beyond rendering — screen and PDF cannot diverge (REP-026), and
the export test asserts the same totals appear in both.

## Contents

- Header: company name, report title, business, financial window, currency.
- Integrity status and each warning code + message (warnings are never
  dropped from the printed output).
- Financial table: hierarchy-indented labels, account codes/names on account
  lines, current amount, comparative and variance columns when present;
  negatives in parentheses; totals emphasized.
- Footer: generated at / by, definition version, page numbers,
  confidentiality note.
- Exception disclosure section when unresolved historical exceptions exist.

Amounts format from exact minor units at render time only. Every export is
audit-logged (business, user, report type, filters hash, format).

Deferred: cover pages, embedded charts and signature blocks for
board/lender packs — cosmetic additions on the same envelope.
