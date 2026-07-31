# Inventory Reporting

`generateModuleReport(db, ctx, request, 'INVENTORY')` in
`subledgerReportsService.js`.

The inventory financial report lists every inventory GL account (explicit
`coaV2SubType`/`systemPurpose` = INVENTORY, name assist for legacy) with
canonical opening, period movement and closing — the financial totals **are**
the GL accounts. Cost of Sales appears on the Income Statement from posted
COST_OF_SALES accounts.

Operational stock valuation (quantities × unit cost) is a supporting schedule
for reconciliation, never an alternative accounting total; the GL value is
never silently changed to match operational inventory. Differences between the
operational register and the Inventory control account are REP-008 findings
raised by the reconciliation service and disclosed on the report.

Fixture assertion: 90,000 purchased − 40,000 issued to COGS → closing 50,000,
sourced entirely from journal lines. Item-level movement/slow-moving views
remain operational-module screens; their financial totals must reconcile to
this report.
