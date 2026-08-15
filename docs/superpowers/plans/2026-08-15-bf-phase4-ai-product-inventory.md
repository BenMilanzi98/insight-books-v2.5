# BF Phase 4 Implementation Plan

**Goal:** AI suggestions + product demand + INVENTORY_DEMAND.

1. Schema `ForecastAiSuggestion` + migration
2. Domain: demandVelocity, aiHeuristic
3. Services: aiSuggestionService, productDemandService; wire INVENTORY_DEMAND in forecastService
4. APIs: `/api/budget-forecast/ai/suggestions`, `/api/budget-forecast/forecasts/[id]/demand`
5. UI forecast detail + create wizard method
6. Vitest
