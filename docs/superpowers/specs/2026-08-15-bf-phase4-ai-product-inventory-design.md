# Budget & Forecast Phase 4 — AI, Product Demand, Inventory

**Status:** Approved 2026-08-15 (scope C)  
**Out of scope:** Live LLM providers, auto-approve forecasts, posting stock/PO/journals.

## Goal

Governed review-only AI suggestions, product sales-velocity demand hints, and `INVENTORY_DEMAND` draft forecast lines — never posts to GL.

## Requirements

1. `ForecastAiSuggestion` + generate/review API (deterministic heuristic). Accept does not auto-write; optional apply-to-assumption-set.
2. Product demand service from invoice line qty × lookback; reorder gap vs stock/reorderPoint.
3. `INVENTORY_DEMAND` method → draft CoA lines (COGS/expense) from suggested purchase $ schedule.
4. UI on forecast detail: AI panel, product demand table, method in regenerate/create.
5. Tenant toggle default off for AI generate (env or first-call opt-in via body `enableAi=true` if no config).

## Non-negotiables

- Suggestions are PENDING_REVIEW until human decision.
- AI never posts journals or mutates stock.
- Inventory demand only writes PlanningForecast lines.
