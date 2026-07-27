# InsightBooks System Admin Reimplementation

Forensic audit and delivery program for the platform admin surface under `/insightbooks`.

## Program status

**COMPLETE (control-plane foundations).** See [FINAL_READINESS_DECISION.md](./FINAL_READINESS_DECISION.md).

| Phase | Outcome | Readiness |
|-------|---------|-----------|
| 1 | Audit docs, CoA UI removal, Admin shell/design system | [PHASE_1_READINESS.md](./PHASE_1_READINESS.md) |
| 2 | Tenants/users/RBAC, settings, support access, entitlements | [PHASE_2_READINESS.md](./PHASE_2_READINESS.md) |
| 3 | Platform billing (not tenant AR) | [PHASE_3_READINESS.md](./PHASE_3_READINESS.md) |
| 4 | Affiliates, Android, Email hardening | [PHASE_4_READINESS.md](./PHASE_4_READINESS.md) |
| 5 | MRA EIS, Audit/Security, real System Health | [PHASE_5_READINESS.md](./PHASE_5_READINESS.md) |
| 6 | Search, reports, imports/exports, residual hardening | [PHASE_6_READINESS.md](./PHASE_6_READINESS.md) |

**Automated tests:** `npx vitest run test/systemAdmin` — see [AUTOMATED_TEST_RESULTS.md](./AUTOMATED_TEST_RESULTS.md) (**15 files / 102 passed** as of finalize).

## Scope

| Surface | Location |
|--------|----------|
| Admin pages | `app/insightbooks/**` |
| Admin APIs | `app/api/admin/**` |
| Shell | `components/shell/AdminShell.jsx`, `components/AdminSidebar/AdminSidebar.js` |
| Design system | `components/admin/*`, admin tokens in `app/globals.css` |
| Permissions / nav | `lib/admin/permissions.js`, `lib/admin/adminNav.js` |
| Auth | `admin_token` via `lib/adminAuth.js` |

This program **does not** redesign the tenant app (`/chart-of-accounts`, tenant billing, POS).

## Locked decisions (honored)

| Decision | Result |
|----------|--------|
| Phased delivery | Followed |
| System CoA UI removal | `/insightbooks/chart-of-accounts` → dashboard `?notice=coa-removed` |
| Keep system-coa APIs | `/api/admin/system-coa*` retained |
| Canonical affiliate | `/insightbooks/affiliate`; `affiliate-system` redirects |
| Canonical audit | `/insightbooks/audit`; `audit-logs` redirects |
| Platform billing ≠ tenant AR | `PlatformInvoice` / platform-billing APIs; admin invoices no longer tenant AR |

## Accepted residuals

- Full cosmetic redesign of every legacy admin form is incremental
- No persisted admin session store (sessions empty; terminate 501)
- Import dry-run does not write (by design)
- Some legacy `/api/admin/*` routes remain auth-only (catalog grows over time)

## Document index

Audit pack (Phase 1), readiness docs (Phases 1–6), gap/risk registers, shell/nav/design docs — all under this folder. Start with [FINAL_READINESS_DECISION.md](./FINAL_READINESS_DECISION.md).
