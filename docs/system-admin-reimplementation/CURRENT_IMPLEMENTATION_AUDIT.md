# Current Implementation Audit

## Architecture today

```
Browser (/insightbooks/*)
  → middleware.js (admin_token cookie required except /insightbooks/login)
  → app/insightbooks/layout.js (client fetch /api/admin/auth/me → AdminShell)
  → AdminShell + AdminSidebar
  → page.js (feature screens)
  → /api/admin/* (mixed: verifyAdminAuth / raw jwt.verify / none)
```

Auth stack:

- Cookie: `admin_token` (set in `app/api/admin/auth/login/route.js`)
- Verify: `lib/adminAuth.js` → `verifyAdminJwtToken` requires `decoded.isAdmin`, loads `Admin` by `adminId`, checks `isActive`
- Permission helper: `adminHasPermission(admin, "category.action")` with **Super Admin bypass**
- Middleware only checks cookie **presence**, not JWT validity or role (layout does secondary check via `/auth/me`)

## What works well

| Domain | Evidence | Classification |
|--------|----------|----------------|
| Tenants | `tenant-management` → `/api/admin/tenants`, delete route | KEEP / EXTEND |
| Subscriptions | `billing/subscriptions` → subscriptions + eis-subscriptions + branch-subscriptions APIs | KEEP / EXTEND |
| Affiliates (canonical) | `affiliate` page wired to `/api/admin/affiliate*` | KEEP |
| Android | `mobile-app` + `MobileAppConfig` / `MobileAppClientEvent` + upload Pages API | KEEP / EXTEND |
| MRA EIS platform | Multiple pages under `mra-eis/*` + rich `/api/admin/mra-eis/*` + `system.eis.*` permissions | KEEP / EXTEND |
| System CoA APIs | `system-coa`, `apply`, `tenant-accounts`, `coa-migration` + `SystemCoaDefinition` | KEEP (APIs); UI REMOVE |
| Admin shell skeleton | AdminShell mirrors tenant AppShell tokenized drawer | REUSE / STANDARDISE |
| Auth basics | login / logout / me | KEEP / REFACTOR (permission depth) |

## What is stubbed or fake

| Surface | Finding | Classification |
|---------|---------|----------------|
| `billing/invoices` | `setTimeout` load; hardcoded stats (156/142/8/6); no API | STUB / REIMPLEMENT |
| `billing/payments` | Same pattern; static UI | STUB / REIMPLEMENT |
| `global-settings` | Local React state; `alert('Settings saved')`; no persistence | STUB / REIMPLEMENT |
| `affiliate-system` | Hardcoded affiliate array; duplicate of real affiliate page | STUB / DUPLICATE / REMOVE |
| `audit-logs` | Hardcoded log rows; duplicate of real audit page | STUB / REMOVE |
| `/api/admin/settings` | Returns hardcoded object (SMTP, pool size, feature flags) | STUB / SECURITY_RISK (misleading) |
| `/api/admin/users/roles` | Comment: "mock data for now"; static Super Admin/Admin/Manager… | STUB |
| Dashboard analytics children | Mixed: some fetch metrics/stats; several present demo-like UX | INCOMPLETE / STUB |

## Duplicate / parallel surfaces

| Pair | Canonical | Action |
|------|-----------|--------|
| `/insightbooks/affiliate` vs `/affiliate-system` | `affiliate` | CONSOLIDATE → REMOVE stub |
| `/insightbooks/audit` vs `/audit-logs` | `audit` | CONSOLIDATE → REMOVE stub |
| System CoA vs tenant CoA | Tenant: `/chart-of-accounts`; System template: `/insightbooks/chart-of-accounts` | REMOVE admin UI; KEEP APIs |
| Platform billing vs tenant invoices | `AccountSubscription` vs `Invoice` / `EISInvoice` | See DUPLICATE_BILLING_RISK_REGISTER |
| AdminAuditLog vs AuditLog vs AdminActivityLog vs SecV2AuditEvent | Fragmented | CONSOLIDATE read model later |

## Authz gaps (current)

1. Many routes re-implement JWT parse instead of `getAdminFromRequest` / `requireAdminPermission`.
2. Cookie presence in middleware ≠ validated admin; expired tokens may briefly hit layout before redirect.
3. No `systemAdmin.*` catalog for tenants/billing/affiliates/settings — only MRA EIS uses structured `system.eis.*`.
4. Super Admin string match (`role === 'Super Admin'`) is the de-facto authorization for most ops.
5. `test-delete`, `test-subscription-delete`, `test-daily-report`, `dashboard/test`, `dashboard/debug` exist under `/api/admin` — several lack proper guards (SECURITY_RISK).

## UI / UX state

- AdminSidebar uses **emoji icons** and inline styles (`#1a202c`), while AdminShell uses CSS variables (`--sidebar-width`, `--surface-primary`).
- Collapsed sidebar currently shows only logout (nav items lost when collapsed) — NON_RESPONSIVE / INCOMPLETE.
- Lucide icons imported in AdminSidebar but navigation still uses emoji strings.
- Footer + AppBar reused from tenant shell with `skipUserFetch` / `skipPermissions` — REUSE with STANDARDISE needed.

## Data model readiness

| Ready for admin ops | Gap |
|---------------------|-----|
| `Admin`, `AdminTenantAccess`, `AdminAuditLog` | Permissions JSON untyped; no catalog |
| `Tenant`, `AccountSubscription`, `BranchSubscription` | Strong |
| `Affiliate*` | Strong |
| `MobileAppConfig`, `MobileAppClientEvent` | Strong |
| `SystemCoaDefinition` | Strong (API-only after UI removal) |
| `EmailLog` | Usable; wire consistently |
| `MraEis*` | Strong / extensive |
| `SecV2*` | Partially surfaced in security pages |
| **PlatformInvoice** | **MISSING** — blocks real platform billing |

## Verdict

The admin app is a **hybrid of mature operational domains and scaffolding stubs**. Reimplementation should **preserve** tenants, subscriptions, affiliates, Android, MRA EIS, and system-coa APIs; **redirect/remove** CoA UI and duplicate stub pages; **rebuild** platform billing and global settings on real models; and **standardise** shell, permissions, and API auth patterns before Phase 5–6 feature growth.
