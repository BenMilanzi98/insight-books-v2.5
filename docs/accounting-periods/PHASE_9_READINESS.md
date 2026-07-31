# Phase 9 Readiness — Operational Module Posting Integration

Phase 8 delivers everything Phase 9 modules need:

| Capability | Status |
| --- | --- |
| Business-scoped Period Resolution Service (`resolvePeriodV2`) | Ready |
| Transaction date / posting date separation in the Posting Command | Ready (Phase 4 + 8) |
| Automatic financial-year and period assignment (server-side) | Ready |
| Closed-period validation with typed errors | Ready |
| Backdating approval policy + permission | Ready |
| Future-dating policy | Ready |
| Non-throwing guard for forms/imports/webhooks (`validatePostingDate`, `/periods/resolve`) | Ready |
| Period audit trail + rejection auditing | Ready |
| Feature flags per business/module/event | Ready |

## Module readiness

Modules already posting through the V2 Posting Engine inherit period
controls when `RESOLVER_V2` is enabled: **Manual journals, adjustment
journals, opening balances, reversals** (Phase 4–6 integrations).

Modules whose posting paths move to the engine in Phase 9 — customer
invoice/payment/credit/refund, supplier bill/payment/credit, expense,
payroll, inventory receipt/COGS/adjustment, bank transactions and charges,
fixed assets and depreciation, loans, taxes, equity events — are **guard-ready**:
their integration task is to route through the Posting Command; no further
period work is needed.

Remaining Phase 9 work: per-module engine adoption, replacing legacy
closed-period checks with the V2 guard, module-scoped flag activation, and
production performance benchmarks under posting load.
