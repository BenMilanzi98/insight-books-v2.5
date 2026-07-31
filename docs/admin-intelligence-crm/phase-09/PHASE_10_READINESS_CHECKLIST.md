# Phase 10 Readiness Checklist

**Gate decision:** **READY_FOR_PHASE_10_WITH_BLOCKERS**

| Check | Status | Notes |
|-------|--------|-------|
| Repo-backed product catalogue | PASS | Instrumented commerce trio + shells |
| Idempotent Invoice / POS / EIS producers | PASS | Retries/reprints/rejects excluded |
| Usage facts + first-value / adoption | PASS | Strict events only |
| Workbench UI + nav + i18n | PASS | Overview honesty (N/A / UNAVAILABLE) |
| Versioned funnels (instrumented only) | PASS | Incomplete when events missing |
| First-value cohorts (no zero-fill) | PASS | Association ≠ causation labelled |
| Deterministic product signals | PASS | Idempotent identity; no probability/revenue |
| Light commerce recon | PASS | Failed recon ≠ false complete metric |
| Export foundation JSON/CSV | PASS WITH LIMITATIONS | Permission + portfolio; no XLSX/PDF |
| Android product usage | FAIL / NOT_INSTRUMENTED | Blocker — version telemetry only |
| Broad module producers (payroll, etc.) | FAIL / NOT_INSTRUMENTED | Blocker — catalogue shells only |
| Support / onboarding instrumentation | FAIL / NOT_INSTRUMENTED | Out of P9 product core |
| FEATURE_USED as live metric | FAIL | Scaffold only; typed commerce events used |
| Login-as-DAU / vanity page views | N/A (forbidden) | Must remain out of scope |
| Tenant Sale as commercial truth | N/A (forbidden) | Must remain out of scope |
| Phase 9 final decision | PASS | READY_FOR_PHASE_10_WITH_BLOCKERS |

**Proceed to Phase 10 only with explicit blockers above.** Prefer instrumenting Android meaningful actions and additional modules before treating fleet product analytics as complete. Never invent conversion, cohort cells, or signal scores for uninstrumented planes.
