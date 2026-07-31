# Current System Audit — `/insightbooks` Control Plane

**Audited:** 2026-07-28  
**Mode:** Read-only forensic discovery (Phase 1)  
**PRD:** `Inteligence & Leads.txt`

## 1. Repository map (application)

```text
Application
├── Public website          app/LandingPageClient.js, auth/signup
├── Authentication          lib/auth.js (tenant) · lib/adminAuth.js (admin JWT)
├── Tenant application      app/(tenant modules), components/Sidebar
├── System Administration   app/insightbooks/** · components/shell/AdminShell
├── Billing (platform)      app/api/admin/platform-billing/** · Platform* models
├── Billing (tenant sub)    app/api/subscription/** · AccountSubscription
├── MRA EIS                 lib/mraEis/** · app/api/admin/mra-eis/** · app/api/mra-eis/**
├── Background workers      scripts/*, jobs (verify schedules separately)
├── Reports                 app/insightbooks/reports · /api/admin/platform-reports
├── Notifications           email APIs · (push TBD)
├── Emails                  PlatformEmailTemplate · /api/admin/email/**
├── Exports / Imports       /insightbooks/imports · various export routes
├── Audit                   AdminAuditLog · /insightbooks/audit*
├── Security                /insightbooks/security* · SecV2* · support-access
└── Tests                   vitest · test/systemAdmin* · test/mraEis*
```

## 2. Stack (evidence)

| Concern | Technology | Evidence |
|---------|------------|----------|
| Framework | Next.js 16 App Router | `package.json` `"next": "^16.2.9"` |
| UI | React 19, Tailwind 4, Lucide, Recharts | `package.json` |
| ORM | Prisma 6 | `package.json` |
| DB | PostgreSQL | Prisma datasource / local ops |
| Admin auth | JWT `admin_token` | `lib/adminAuth.js` |
| Charts | Recharts | Admin dashboard / chart components |
| i18n | JSON locales `en` + `ny` | `locales/**` — **admin largely hardcoded English** (`locales/en/administration.json` minimal) |
| Tests | Vitest | `npm test` scripts |

## 3. What exists and is usable

| Area | Status | Classification |
|------|--------|----------------|
| Admin shell + nav | Present (`AdminShell`, `adminNav.js`) | `KEEP` / `EXTEND` |
| Admin UI kit | `components/admin/*` (tables, charts, modals, …) | `REUSE` |
| Tenant management | Pages + `/api/admin/tenants*` | `KEEP` |
| User management | Pages + `/api/admin/users*` | `KEEP` |
| Platform billing UI/API | Plans, invoices, payments, credits, refunds, recon | `KEEP` / `EXTEND` |
| MRA EIS admin + plans | Entitlement + commercial plans | `KEEP` / `EXTEND` |
| Affiliates | Models + admin routes | `KEEP` |
| Email management | Templates / suppression | `KEEP` |
| Mobile app admin | Present | `KEEP` |
| Security / audit / health | Present surfaces | `EXTEND` |
| Support access | `PlatformSupportAccess` + API | `KEEP` — not a ticketing CRM |
| COA admin route | Stub redirect only | `KEEP` (must remain removed) |

## 4. Critical defect — financial source of truth

**Finding:** `/api/admin/dashboard/stats` aggregates **Tenant** `Sale` / `Expense` / `Invoice` totals and exposes them as platform dashboard “revenue” / “profit”.

Evidence (`app/api/admin/dashboard/stats/route.js`):

```js
prisma.sale.aggregate({ _sum: { total: true } }) // labelled total revenue from all sales
prisma.expense.aggregate({ _sum: { amount: true } })
```

Also stubs several subscription metrics as `Promise.resolve(0)`.

| Classification | `UNSAFE` · `INCORRECT` for SaaS BI |
|----------------|-------------------------------------|
| Impact | Future Executive / Revenue Intelligence must **not** reuse this endpoint as SaaS MRR |
| Required action (later phase) | Replace with PlatformInvoice / PlatformPayment / AccountSubscription query pack |

## 5. Dual nav risk

| Nav | Risk |
|-----|------|
| `lib/admin/adminNav.js` | Canonical for AdminShell |
| `components/Sidebar` masterAdmin block | Still lists `/insightbooks/*` admin links — **drift / DUPLICATED** |

## 6. Dual billing planes

| Plane | Models | Notes |
|-------|--------|-------|
| Commercial subscription | `AccountSubscription` + PayChangu | **Live** cash/access path (status often `Completed`) |
| Platform ledger | `PlatformInvoice`, `PlatformPayment`, credits, refunds | Admin/renewal-oriented; PayChangu may write Payment **without** Invoice |
| Relationship | **DISCONNECTED** | Cannot claim closed-book SaaS AR from checkout alone today |
| Subagent evidence | [routes](fee886d8-afa9-43ec-972e-505320d76847) · [billing](edd33e5b-e0d0-437d-8506-d60f3f496be8) · [CRM gaps](0d3be3a9-605e-47c9-90bb-f9a70c3fa081) | Merged into this pack |

## 7. CRM / Intelligence readiness (summary)

| Domain | Ready? |
|--------|--------|
| Lead / Pipeline / Demo / Proposal | **No models** — see `CRM_GAP_REGISTER.md` |
| Product analytics events | **No event store** — see `EVENT_TRACKING_AUDIT.md` |
| Customer health | **No** |
| Support tickets | **No** (support-access ≠ tickets) |
| Bilingual admin CRM | **Not ready** — admin strings mostly hardcoded |

## 8. Safe reuse for later phases

1. AdminShell + permission catalog + admin component kit  
2. Platform billing models (after dashboard revenue fix)  
3. Tenant / User / Affiliate graphs  
4. MRA EIS entitlement + commercial plan separation  
5. AdminAuditLog + PlatformSupportAccess patterns for conversion/impersonation audit  

## 9. Explicit non-goals preserved

- Do not reintroduce System Chart of Accounts UI  
- Do not post Tenant journals from Admin intelligence  
- Do not implement CRM UI in Phase 1
