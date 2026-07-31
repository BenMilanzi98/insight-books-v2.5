# Upgrade / Downgrade Audit

**Date:** 2026-07-28

| Capability | Classification |
|------------|----------------|
| Proration engine | NOT_APPLICABLE — missing |
| Upgrade preview (server) | GAP |
| Downgrade limit conflict detection | GAP |
| Billing-cycle change | GAP |
| PayChangu plan replace | REUSE pattern (deactivate others) — unsafe for multi-product |
| PlatformPlanVersion for catalog price changes | REUSE — does not migrate subscribers |

## Required

Change records, server proration Decimal math, limit conflict checks, effective-date policies (immediate / at renewal), history preserved.
