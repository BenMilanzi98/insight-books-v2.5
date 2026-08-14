# Cost of Goods rename, P&L COGS placement, and auto-posted CIT

**Date:** 2026-08-14  
**Status:** Approved in conversation; awaiting spec file review  
**Decisions:** Approach 1 (three slices, one release); CIT option **B** (display + auto-post to ledger)

## Problem

1. User-facing and CoA labels still say **Cost of Sales**; product language should be **Cost of Goods** / **Cost of Goods Sold**.  
2. On Profit & Loss, account **5110** (and COGS leaves) can appear under operating expenses instead of after Revenue as the Cost of Goods line that produces Gross Profit.  
3. Net profit is a single line; the business needs **Net Profit Before Tax** and **Net Profit After Tax**, with **Corporate Income Tax 30% (outflow)** from `/tax-management/accounts` auto-calculated and **posted** to the ledger.

## Goals

- Rename Cost of Sales → Cost of Goods (and 5110 display → Cost of Goods Sold) across CoA structure, templates, reports UI, and safe tenant heal of display names.  
- P&L order: Revenue → Cost of Goods → Gross Profit → Operating expenses (no 511x) → … → NPBT → CIT expense → NPAT.  
- Auto-post CIT provision journals idempotently per period when P&L is generated/applied with Accrual (and define cash-basis behavior).  
- Rate and enablement come from tax management (Corporate Income Tax / MW-CIT style outflow, typically 30%).

## Non-goals

- Renaming internal Prisma/enum keys such as `COST_OF_SALES` category codes (keep for compatibility; alias in UI).  
- Rewriting all historical journal descriptions that said “Cost of Sales”.  
- Full Malawi supernormal / MAT alternative tax matrix in v1 (standard CIT rate from enabled tax code only).  
- Auto-filing tax returns.

## Slice 1 — Naming

| Surface | Change |
| --- | --- |
| `lib/coaSystemStructureTree.js` | `5100` name → `Cost of Goods`; `5110` name → `Cost of Goods Sold` |
| Chart blueprint / ensure templates | Same display names for new tenants |
| Tenant heal | Update `accountName` where code is `5100`/`5110` (and optional header variants) if name matches old Cost of Sales / Purchases patterns — only when clearly system defaults |
| Reports / IS labels | `cost-of-sales` line label → `Cost of Goods` |
| UI copy | Prefer “Cost of Goods” / “Cost of Goods Sold” in user-visible strings touched by this work |

## Slice 2 — P&L COGS placement

- Keep IS definition line `cost-of-sales` (id stable) with label **Cost of Goods**, matching `COST_OF_SALES` / 5110–5199.  
- Ensure `assignAccountsToLines` maps 511x / COGS category to that line, **not** `operating-expenses`.  
- Slim P&L presentation must **never** fold `cost-of-sales` into operating expenses.  
- Gross Profit = Revenue − Cost of Goods (existing formula).  
- Operating expenses exclude COGS codes and COGS categories (align with `incomeStatementOperatingExpenseRollup` / report match rules).

## Slice 3 — NPBT / CIT / NPAT + auto-post

### Presentation

Replace single `net-profit` presentation with:

1. **Net Profit Before Tax** (existing profit-before-tax / net before CIT)  
2. **Corporate Income Tax** (expense line; amount = provision)  
3. **Net Profit After Tax** (= NPBT − CIT)

(Internal line ids may remain `profit-before-tax`, `tax-expense` / `cit-provision`, `net-profit` with updated labels.)

### Tax source

- Resolve enabled **Corporate Income Tax** outflow from tax management / Malawi catalog (`MW-CIT` or equivalent linked tax type/account).  
- Use configured rate (default **30%** if code enabled at 30%).  
- If CIT not enabled / not found: show tax line as 0 with warning; do not invent a silent rate.

### Auto-post (option B)

On Accrual P&L generate/Apply for a period `[fromDate, toDate]` (or fiscal period key):

1. Compute NPBT from the same engine as the statement.  
2. `citMinor = round(NPBT_minor × rate)` (only if NPBT > 0; if loss, tax = 0 unless tax code says otherwise).  
3. Upsert journal:  
   - Dr Income tax expense (CIT expense GL from tax mapping / CoA)  
   - Cr Tax payable / Tax Outflow child (CIT payable mapping under 2045 outflow)  
4. Idempotency: `sourceType = 'CitProvision'`, `sourceId = `${tenantId}:${periodKey}`` (e.g. `2025` or `2025-01`–`2025-12` hash of from–to). Re-run reverses/replaces prior provision for that key rather than stacking.  
5. Statement tax line prefers **posted CIT provision + other tax expense** for the period, or shows computed provision consistent with the journal just upserted.

### Cash-basis P&L

- Display NPBT / CIT / NPAT using cash NPBT × rate for **display**, but **do not** auto-post CIT on cash-basis runs (posting remains accrual-period provision). Document in footer.

### Period rules

- Provision posts only when the target accounting period is **open**.  
- If period closed: show calculated tax on report with warning “Period closed — CIT not posted”; do not mutate closed periods.

## Acceptance criteria

- [ ] CoA structure shows Cost of Goods / Cost of Goods Sold for 5100/5110.  
- [ ] P&L: 5110 under Cost of Goods after Revenue; Gross Profit correct; not under OpEx.  
- [ ] P&L shows Net Profit Before Tax, CIT, Net Profit After Tax.  
- [ ] Enabled 30% CIT from tax management drives the rate.  
- [ ] Accrual Apply/generate upserts one CitProvision journal per period key; second run does not double tax.  
- [ ] Closed period does not post.  
- [ ] Cash P&L does not post CIT.

## Risks

- Mis-mapped expense accounts still in COGS range → tighten match rules and tests.  
- Wrong GL for CIT expense/payable → require tax-management mapping; fail closed with clear error if missing when CIT enabled.  
- Multi-branch: provision is tenant-wide unless branch filter is set (then branch-scoped journal + branchId).

## Open questions

None — naming, P&L order, and CIT option B approved 2026-08-14.
