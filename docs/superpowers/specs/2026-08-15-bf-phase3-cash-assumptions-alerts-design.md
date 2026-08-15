# Budget & Forecast Phase 3 — Cash, AR/AP, Assumptions, Alerts

**Status:** Approved 2026-08-15  
**Scope:** Phase 3 only. Phase 4 (AI / inventory demand) out of scope.

## Goal

Cash outlook with monthly roll-forward, open AR/AP timing into forecasts, assumption sets attached to forecasts, and dashboard alert callouts — never posts to the ledger.

## Approach

Extend greenfield `lib/budgetForecast`. Reuse `ForecastAssumptionSet` / `ForecastAssumption`. Read AR from `Invoice.remainingBalance`, AP from `SupplierBill` outstanding.

## Requirements

1. **Cash roll-forward** — opening GL cash/bank → monthly receipts/payments/closing; wire CASH_FLOW generate + Cash Outlook report months.
2. **OPEN_RECEIVABLES / OPEN_PAYABLES** — age open docs into forecast months by buckets (current→m0, 1–30→m0/m1, …).
3. **Assumptions** — CRUD API + attach on create/regenerate; apply GLOBAL/account PERCENT growth overlays.
4. **Alerts** — cash dip &lt; 0; revenue under budget; expense over budget; missing source budget for BUDGET_REMAINDER.
5. **UI** — wizard methods + assumption picker; detail cash months; forecasts dashboard alerts.

## Non-negotiables

- Read-only actuals/AR/AP; projections never create journals.
- Status only via intent commands.
