# Final Readiness Decision — Enter Phase 9 Wave 1

**Decision:** CONDITIONAL GO (Wave 1+)

**Date:** 2026-07-29

## Rationale

Phase 4 analytics plane is reusable; RBAC/nav/plan entitlements seed a repo-backed catalogue; MRA/Invoice/POS domain tables are documented **candidates**. No Product Analytics UI or FEATURE_USED producers exist yet — which is expected. Strict-events policy prevents false adoption.

## Conditions

1. Live metrics only after idempotent AnalyticsEvent producers.
2. Domain table counts must not power UI numbers until producers + facts exist.
3. Page views / login alone never count as value or activation.
4. Commerce producers first (Invoice → POS → MRA accepted); retries/reprints excluded.
5. Reliability gate returns NOT_INSTRUMENTED — never zero — when blocked.
6. Expected exit: **READY_FOR_PHASE_10_WITH_BLOCKERS** until broad instrumentation/Android exist.
7. CoA admin route stays removed; no invasive tracking; no Tenant Sale.

## Wave 0 checklist

- [x] Input validation vs Phase 8 handoff  
- [x] CURRENT_* audits (non-empty)  
- [x] Source / module-feature / entitlement / meaningful-action / first-value / activation / adoption / retention / funnel / reliability / security matrices  
- [x] Gap register + implementation plan pointer  
- [x] This decision recorded  

**Next:** User chooses Subagent-Driven or Inline execution for Waves 1–4.
