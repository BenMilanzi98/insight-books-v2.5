# Fixed Asset Reporting

`generateModuleReport(db, ctx, request, 'FIXED_ASSETS')`.

Covers asset cost accounts, accumulated depreciation, intangibles and
investments (explicit sub-types FIXED_ASSET / PROPERTY_PLANT_EQUIPMENT / PPE /
ACCUMULATED_DEPRECIATION / INTANGIBLE / INVESTMENT / NON_CURRENT_ASSET, name
assists for legacy charts). Each account line shows opening, movement and
closing from canonical journal lines; the report total is the net book value
of the GL accounts.

Financial-statement asset totals are never calculated independently from the
GL: the Balance Sheet PP&E and accumulated-depreciation lines read the same
canonical balances, and depreciation expense flows through the Income
Statement's Depreciation and Amortization line.

Fixture assertion: equipment 300,000 − accumulated depreciation 5,000 → net
295,000; depreciation expense 5,000 on the Income Statement; the depreciation
add-back classifies as OPERATING in the Cash Flow.

The operational Fixed Asset Register (per-asset acquisition, depreciation
schedule, disposals, NBV) remains the asset module's screen; REP-009 findings
from the reconciliation service disclose any difference between the register
and asset/depreciation GL accounts.
