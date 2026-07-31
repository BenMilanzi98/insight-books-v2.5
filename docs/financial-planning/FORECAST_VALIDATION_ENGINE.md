# Forecast Validation Engine

Integrity codes (selected):

| Code | Rule |
|---|---|
| FPL-009 | Projected Balance Sheet must balance |
| FPL-010 | CF closing cash = BS cash |
| FPL-002 | Forecast must not write to GL (architectural) |
| FPL-006 | Approved forecast immutable |
| FPL-030 | AI suggestion without review blocked |

Statuses: `NOT_CALCULATED` → `VALIDATING` → `VALID` / `VALID_WITH_WARNINGS` / `INVALID` / `BLOCKED`.

Approval requires non-INVALID / non-BLOCKED integrity (`approveForecastVersion`).
