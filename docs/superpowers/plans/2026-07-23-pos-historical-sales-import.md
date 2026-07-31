# Plan — POS Historical Sales Import

Implemented 2026-07-23.

## Files

- `lib/historicalSalesImport/*` — parse, dates, validate, commit
- `app/api/historical-transactions/template|preview|batch-upload`
- `components/pos/HistoricalSalesImportWizard.jsx`
- `app/pos/page.js` — wizard + no-stock historical lines
- `app/api/stock/route.js` — `pos=1` excludes services
- `app/services/salesService.js` — `catalog=products`
- `app/api/sales/route.js` — skip stock/FIFO for historical
- `test/historicalSalesImport.test.js`
