# AI Forecast Governance

- Suggestions stored in `PlanV2AISuggestion` with `PENDING_REVIEW`.
- Accept / reject requires `financialPlanning.reviewAISuggestions`.
- Acceptance does **not** write assumptions or approve forecasts automatically.
- AI never posts Journal Entries and never writes unrestricted SQL.
- Deterministic heuristic provider: `DETERMINISTIC_HEURISTIC_V1` (safe fallback).
- Flag `aiForecastSuggestionsEnabled` is **not** in DEFAULT_ENABLED_FLAGS.
- Business config `aiSuggestionsEnabled` defaults false.
