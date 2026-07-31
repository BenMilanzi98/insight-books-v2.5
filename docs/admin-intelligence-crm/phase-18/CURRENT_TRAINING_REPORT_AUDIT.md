# Current Training Report Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Training reports catalogue | NOT_FOUND | No `training/reports.js` |
| Reliability-gated metrics | NOT_FOUND | Gate fail → UNAVAILABLE / `value: null` — never false zero |
| Onboarding / conversion report patterns | CORRECT_AND_REUSABLE | Reuse honesty gate patterns from onboarding/conversions Wave 4 |
| Foundations progress as Training KPI | WRONG_SOURCE / FORBIDDEN | `progressPercent: null` when empty; inventProgressForbidden |

**Implication:** Wave 4 reports via reliability gate; never invent zeroes from foundations emptiness.
