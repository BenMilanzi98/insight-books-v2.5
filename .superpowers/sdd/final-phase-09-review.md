# Final Phase 9 Review — Product Analytics (whole-phase)

**Date:** 2026-07-29  
**Mode:** Read-only whole-phase review  
**Plan:** `docs/superpowers/plans/2026-07-29-product-analytics-phase-09.md`  
**Design:** `docs/superpowers/specs/2026-07-29-product-analytics-phase-09-design.md`  
**Ledger:** `.superpowers/sdd/progress-phase09.md`  
**Notes:** `.superpowers/sdd/final-phase09-review-notes.md`  
**Exit:** `docs/admin-intelligence-crm/phase-09/FINAL_PHASE_09_REPORT.md` → **READY_FOR_PHASE_10_WITH_BLOCKERS**

**Per-task verdicts:** P9-1…P9-4 Spec Compliance **Approved** | Task quality **Approved** (after remediations).

---

## Scope inspected

| Surface | Paths reviewed |
|---------|----------------|
| Catalogue | `lib/admin/productCatalogue/*` |
| Analytics core | gate, firstValue, adoption, facts, funnels, signals, export, overview, authz, producers |
| Commerce producers + call sites | invoice/POS routes; MRA online/offline/reconcile |
| Permissions / nav | `intel.productAnalytics.*` in permissions + NAV map (via task reviews) |
| Exit / Phase 10 pack | FINAL report, PHASE_10_INPUTS, readiness decision |
| Evidence | Task reviews + notes; Vitest accepted from implementer/controller |

Did **not** crawl the entire repo. Did not re-run Vitest this review.

---

## Strengths

1. **Strict-events honesty end-to-end** — Reliability gate never returns numeric zero on failure; uninstrumented (`payroll.run`) → `NOT_INSTRUMENTED`; overview count failures → `UNAVAILABLE` + `value: null`; funnels use null conversion / `INCOMPLETE` (not invented 0%); cohorts refuse zero-fill.
2. **Commerce trio is real, not scaffold** — Typed events only; `FEATURE_USED` / scaffold rejected at emit; idempotent keys; invoice fail-closed without posted status; POS requires completed; EIS excludes reject/retry/reprint; call sites cover create/post, POS complete, online + offline (`transitionTransmissionStatus`) + reconcile accept.
3. **Live value pipeline** — Outbox → `consumeProductUsageFacts` → usage fact → `recordOrLoadFirstValue` with source verification; adoption GET/POST opt-in persist; uninstrumented never advances to fake active states.
4. **Wave 4 consistency after remediations** — Portfolio scoping on funnels/signals/export/overview/cohorts/recon; Reports gated on `productAnalytics.export`; deterministic signals with forbidden probability/revenue keys stripped; exit correctly `READY_FOR_PHASE_10_WITH_BLOCKERS`.
5. **Dual architecture matches design** — Repo-backed catalogue + productAnalytics engines + Phase 4 plane; Prisma models for usage / first-value / adoption history; Phase 10 inputs list blockers honestly (Android, broad modules, support, FEATURE_USED, DAU proxies, export foundation).
6. **Task-level remediations stuck** — EIS offline/reconcile emit, invoice fail-closed, first-value live path + evidence checks, portfolio/Reports Important items all verified closed in task re-reviews.

---

## Critical

_None._

No open release-blocking correctness or honesty defects on the Phase 9 Product Analytics surfaces reviewed. Prior Critical (live first-value pipeline) was fixed in P9-2 and remains wired via `runFactConsumers`.

---

## Important

1. **Commit isolation required before any commit** — Working tree is large (~980 short-status lines) with unrelated deletes/mods alongside Phase 9. Phase 9 libraries/UI/tests/docs are largely untracked; producer call sites, `prisma/schema.prisma`, `lib/admin/permissions.js`, and `lib/admin/analytics/*` sit among other invoice/sales/EIS churn. **When the user asks to commit:** stage only Phase 9 + intentional deps (catalogue, productAnalytics, APIs/UI, tests, phase-09 docs, producer call-site hunks, analytics consumers/outbox touchpoints, prisma models, permissions, SQL script). Do not bundle unrelated tree cleanup.

2. **Runtime SQL / Prisma apply still required** — Models exist in `schema.prisma`; notes flag `scripts/sql/product-analytics-phase09-wave2.sql` (especially if `prisma generate` hits EPERM). APIs depending on `AnalyticsFactProductUsage` / `ProductFirstValueFact` / `ProductAdoptionStateHistory` will fail closed / UNAVAILABLE until applied — expected, but must be part of deploy/commit checklist.

---

## Minor

1. **`evaluate` POST still defaults `persist !== false` for adoption** — Dedicated adoption route is opt-in; evaluate remains mutate-by-default (`app/api/.../evaluate/route.js`). Align if desired.
2. **`resolveProductAnalyticsAccess` file comment vs code** — Header mentions `dashboard.view` break-glass; `canView` is `productAnalytics.read` OR `product.read` only (stricter than comment).
3. **Entitlement plan matching remains heuristic** — Observe-only; can over-state `INCLUDED` until plan codes align (carried from P9-1).
4. **Write/evaluate APIs authorize with `canView`** — Manage/export/recon perms exist but mutate paths largely use view; fine for Wave 2–4, tighten when manage matures.
5. **UI polish** — MetricCard `NOT_INSTRUMENTED` / `Unavailable` English-only; catalogue vs overview status label wording; Reports shell loadable without export (API still 403); export UI JSON-first (CSV route supported); cohorts omitted from export datasets; Definitions stub.
6. **Ledger incomplete** — `progress-phase09.md` records Tasks 0–3 only; Task 4 complete in code/exit docs/task review — update ledger when convenient.
7. **Test depth gaps (non-blocking)** — No dedicated overview-pack unit for count-failure honesty; no direct reconciliationOrchestrator integration test (producer + shared-key coverage exists); signal pack status soft-error path.

---

## Spec / exit alignment

| Design / plan expectation | Status |
|---------------------------|--------|
| Wave 0 matrices + CONDITIONAL GO | Met (docs pack) |
| Dual catalogue + analytics; Phase 4 events only | Met |
| Commerce producers first; retries/reprints excluded | Met |
| First-value / adoption instrumented-only | Met |
| Workbench + honest UNAVAILABLE | Met |
| Funnels/signals/recon/export; no invented causation/revenue | Met |
| Exit `READY_FOR_PHASE_10_WITH_BLOCKERS` | Met |
| CoA admin not reintroduced; no Tenant Sale as SaaS revenue | Met (no CoA under PA surface) |
| Commits only when user asks | Met (WORKING_TREE) |

Known Phase 10 blockers in the final report (broad instrumentation, Android, support/onboarding, FEATURE_USED, login DAU, export depth, retention/journey, definition browser) are **documented exit blockers**, not Phase 9 commit blockers.

---

## Vitest evidence (accepted)

| Bundle | Count | Source |
|--------|------:|--------|
| Catalogue + producers | 22 | P9-1 re-review |
| Adoption / first-value | 12 | P9-2 re-review |
| **Subtotal** | **34** | As requested |
| Wave 4 + PA nav | 19 | P9-4 re-review |
| Wave 3 nav/shell/catalogue suite | 24 | Implementer (P9-3; not re-run) |

This final review did not re-execute Vitest; evidence from task reviews / implementer runs is accepted.

---

## Assessment

**Ready to commit when user asks? yes with caveats**

Caveats:

1. Stage **only** Phase 9 Product Analytics surfaces + intentional producer/analytics/prisma/permissions deps — isolate from the rest of the dirty tree.
2. Include / apply Wave 2 SQL (or equivalent migrate) so live DB matches schema.
3. Carry Minor polish items; do not treat documented Phase 10 instrumentation blockers as commit stoppers.
4. Optionally update `progress-phase09.md` Task 4 = complete before/with commit hygiene.

**Phase quality:** Shippable for authorised System Admin use on the instrumented commerce trio, with honesty gates intact and exit readiness correctly blocked for fleet-complete Product Analytics.
