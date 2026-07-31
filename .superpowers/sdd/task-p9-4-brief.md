### Task 4: Wave 4 — Funnels/cohorts/signals/recon/export + Phase 10 pack

**Files:**
- `lib/admin/productAnalytics/{funnels,cohorts,signals,reconcile,export}.js` (and related)
- Wire Task 3 stub pages that are in scope for instrumented commerce/MRA
- Docs: `docs/admin-intelligence-crm/phase-09/FINAL_PHASE_09_REPORT.md`, `PHASE_10_INPUTS.md`, `PHASE_10_READINESS_CHECKLIST.md`
- Tests: extend product analytics vitest for funnel step order / signal dedupe / recon honesty

**Requirements:**
- Funnels only for instrumented features (invoice/POS/EIS) — versioned; incomplete when missing events
- Cohorts only with first-value anchors where facts exist; no zero-fill missing periods
- Deterministic product risk/opportunity signals; no invented probability/revenue; idempotent identity
- Light recon: catalogue vs events/facts for commerce trio; failed recon ≠ false complete metric
- Export foundation JSON/CSV (portfolio/permission aware)
- Exit readiness **READY_FOR_PHASE_10_WITH_BLOCKERS** documenting Android/broad modules/support blockers
- Association labels must say association not causation if any association helpers exist
- **Do not git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>"**

- [ ] Funnel/signal/recon tests PASS
- [ ] Phase 10 pack written
- [ ] Final readiness WITH_BLOCKERS
