# Reimplementation Plan (Phased Summary)

## Principles

1. **Phased delivery is locked** — ship safety and IA before greenfield billing.
2. **Preserve strong domains** — tenants, subscriptions, affiliates, Android, MRA EIS, system-coa APIs.
3. **Keep existing path names** — e.g. `tenant-management`, not `/tenants` clones.
4. **CoA UI out; APIs stay** — redirect with `notice=coa-removed`.
5. **No fake money UI** — stubs removed or clearly disabled until PlatformInvoice exists.
6. **EIS permission model is the template** for `systemAdmin.*`.

## Phase 1 — Foundation & safety

**Goal:** Stop bleeding; enforce locked CoA policy; kill test endpoints.

- Remove/lock `test-delete`, `test-subscription-delete`, dashboard debug/test, etc.
- JWT validation for `/insightbooks` (or equivalent harden).
- Add `lib/systemAdminPermissions.js` (catalog + helpers) alongside `adminHasPermission`.
- Redirect `/insightbooks/chart-of-accounts` → dashboard notice; remove nav item.
- Redirect `affiliate-system` → `affiliate`; `audit-logs` → `audit`.
- Label or disconnect tenant-AR invoices API from billing UI.
- Smoke tests for auth + redirects.

**Exit:** No open unauthenticated admin test routes; CoA UI gone; duplicates redirected.

## Phase 2 — Shell & navigation

**Goal:** One admin chrome, permission-aware nav, design tokens.

- AdminSidebar v2 (Lucide, tokens, icon rail, no CoA, no stubs).
- AdminShell polish (width contract, mobile overlay already present — keep).
- Extract `adminNavigation` config module.
- Admin notice component for query banners.
- Refactor worst PrismaClient-per-request routes as touched.

**Exit:** Nav matches TARGET_ROUTE_ARCHITECTURE; responsive collapse works.

## Phase 3 — Core ops KEEP domains

**Goal:** Harden what already works.

- Tenants: permissions, confirm delete, audit.
- Subscriptions + branch + EIS subscription hooks: clearer status UX.
- Affiliates: keep canonical page; payout/password permissioned.
- Mobile app: grace/force/maintenance; analytics retention note.
- Email management: permission + history integrity.
- User management: replace mock roles path with real Admin role/permission editor (MVP).

**Exit:** Mutating core APIs require `systemAdmin.*` (or Super Admin).

## Phase 4 — MRA EIS admin

**Goal:** Fit EIS suite into new shell/IA without regressing controls.

- Nested nav for centre, configuration, catalogue, mappings, terminals, tenant detail.
- Keep `system.eis.*` enforcement; reuse services.
- Pagination/perf for large catalogues.
- Copy hygiene vs billing domains.

**Exit:** EIS admin usable under new shell; tests still green.

## Phase 5 — Platform billing

**Goal:** Real SaaS billing surfaces.

- Introduce `PlatformInvoice` (+ payment/settlement model as needed).
- Rebuild `billing/invoices` and `billing/payments` against new APIs.
- Rewire `billing/overview` to subscriptions + platform ledger.
- Split tenant AR support API away from platform invoices.
- Clarify `subscription-payment` admin role.

**Exit:** No stub numbers; no tenant Invoice in platform billing UI.

## Phase 6 — Observability & settings

**Goal:** Replace remaining scaffolding.

- Persist global settings (real store).
- Dashboard analytics: SaaS-labeled metrics only.
- Consolidate audit reading; SecV2 monitoring MVP.
- Performance pass on aggregates.
- Expand tests beyond EIS.

**Exit:** No STUB pages in primary nav; settings save for real.

## Dependency graph

```
Phase1 (safety, CoA, redirects)
  → Phase2 (shell/nav)
      → Phase3 (core ops) → Phase5 (billing needs subscriptions truth)
      → Phase4 (EIS) can parallel Phase3 after Phase2
  → Phase6 after Phase3 baseline (settings/metrics)
```

## Explicit non-rewrites

- Do not rewrite tenant accounting V2 / POS.
- Do not delete `SystemCoaDefinition` or system-coa API handlers in Phase 1.
- Do not merge admin into tenant AppShell component file — keep AdminShell sibling.
