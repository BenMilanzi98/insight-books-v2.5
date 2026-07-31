# Target Architecture — Admin Intelligence Command Centre & Sales CRM

**Defined:** 2026-07-28  
**Status:** Architecture only (Phase 1) — **do not implement modules yet**  
**PRD:** `Inteligence & Leads.txt`

---

## 1. Architectural intent

Transform `/insightbooks` into a **platform control plane** that hosts:

1. SaaS Business Intelligence (executive, revenue, customer, product)  
2. Customer Success / Support / Infrastructure / Security intelligence  
3. Lead Management & Sales CRM (pre-tenant lifecycle)  
4. Evidence-based AI recommendations  

It must **never** become an alternate Tenant accounting UI.

```text
┌─────────────────────────────────────────────────────────────────┐
│                     /insightbooks CONTROL PLANE                   │
├──────────────────┬──────────────────┬───────────────────────────┤
│ Platform Ops     │ Intelligence     │ Sales CRM                 │
│ Tenants/Users    │ Executive KPIs   │ Leads → Pipeline          │
│ Billing (SaaS)   │ Revenue (SaaS)   │ Activities/Demos/Props    │
│ MRA EIS ops      │ Customer Health  │ Conversion → Tenant       │
│ Affiliates       │ Product Analytics│ Onboarding / Training     │
│ Email / Mobile   │ Support / Infra  │ Sales Reporting           │
│ Audit / Security │ AI (evidence)    │                           │
└──────────────────┴──────────────────┴───────────────────────────┘
                              │
                              │ never posts Tenant GL
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     TENANT APPLICATION PLANE                      │
│  Accounting · POS · Invoices · CoA · Payroll · …                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Source-of-truth layers

| Layer | Authoritative stores | Consumers |
|-------|----------------------|-----------|
| **Operational** | Tenant, User, AccountSubscription, PlatformInvoice/Payment/Credit/Refund, Affiliate*, MraEis*, AdminAuditLog, PlatformSupportAccess, future Lead* | Mutations, workflows, legal records |
| **Derived read models** (future) | Daily SaaS revenue snapshot, tenant activity daily, funnel daily | Charts, KPIs, AI — **rebuildable**, never replace ops rows |
| **Forbidden as SaaS revenue** | Tenant Sale, Expense, Invoice, journals | Tenant BI only (out of scope for platform MRR) |

### SaaS revenue query pack (target contract)

```text
Inputs (allowed):
  PlatformPayment (+ allocations)
  PlatformInvoice (+ lines)
  PlatformCredit / PlatformRefund
  AccountSubscription (for entitlement/access state & plan mix — not cash alone)

Outputs:
  Collected cash, invoiced amount, MRR/ARR definitions (documented), churn proxies

Never:
  SUM(Sale.total), SUM(Expense.amount), Tenant Invoice totals
```

---

## 3. Bounded contexts (future modules)

| Context | Scope tags | Extends existing? | New models? |
|---------|------------|-------------------|-------------|
| Platform Ops | PLATFORM_GLOBAL | Yes — KEEP | Minimal |
| SaaS Billing Intelligence | TENANT_SCOPED rollups | Yes — Platform* | Snapshots later |
| MRA EIS Intelligence | TENANT_SCOPED | Yes — entitlement + EIS SKUs | No third gate |
| Product Analytics | TENANT_SCOPED / USER_SCOPED | No event store today | AnalyticsEvent |
| Sales CRM | SALES_TEAM / LEAD_OWNER | No | Lead, Stage, Activity, Demo, Proposal, Task |
| Conversion | LEAD → TENANT | Partial (tenant create) | Conversion record + idempotency key |
| Customer Success | TENANT_SCOPED | Partial signals | HealthScore, SuccessPlay |
| Support Desk | TENANT_SCOPED | Support-access ≠ tickets | SupportTicket |
| Security Intelligence | SECURITY_RESTRICTED | AdminAuditLog / SecV2 | Extend views |
| AI Recommendations | Evidence packs only | Blocked until sources | Insight + citation store |

---

## 4. Target route architecture (not built)

Preserve existing ops routes. Add **new trees** (do not overload `/dashboard` forever):

```text
/insightbooks
├── (existing ops: tenants, users, billing, mra-eis, affiliate, email, mobile, security, audit, health…)
├── intelligence/
│   ├── executive
│   ├── revenue
│   ├── customers
│   ├── product
│   ├── success
│   ├── support
│   ├── infrastructure
│   └── security
├── crm/
│   ├── leads
│   ├── pipeline
│   ├── activities
│   ├── demos
│   ├── proposals
│   ├── calendar
│   └── reports
├── marketing/          # attribution — after instrumentation
└── chart-of-accounts   # MUST remain redirect stub only
```

Navigation: extend `lib/admin/adminNav.js` only; retire Sidebar masterAdmin drift.

---

## 5. API architecture (target)

| Pattern | Rule |
|---------|------|
| Auth | `getAdminFromRequest` on all admin intel/CRM APIs |
| Permissions | `intel.*.read`, `crm.leads.*`, export-specific keys |
| Scope | Every response documents scope tag; tenant drill-downs require `tenantId` |
| Idempotency | `Idempotency-Key` / unique business keys on Lead create, conversion, payment ingest, events |
| Mutations | CRM/ops mutations only; **no** Tenant GL posting |
| Analytics ingest | Append-only; dedupe on `eventId` / hash |
| AI | Read evidence packs; never invent metrics |

Suggested namespaces (future):

- `/api/admin/intelligence/*` — read models / KPIs  
- `/api/admin/crm/*` — leads, pipeline, activities  
- `/api/admin/analytics/events` — ingest (instrumentation)  
- Keep `/api/admin/platform-billing/*` as financial ops truth  

Deprecate or re-label unsafe fields on `/api/admin/dashboard/stats` before Intelligence Phase 3+.

---

## 6. Data model strategy

### Extend (preferred)

- `Admin` / permissions — sales + intel roles  
- `PlatformPlanVersion` — already hosts core + MRA EIS commercial  
- `AccountSubscription` — commercial access state  
- `PlatformInvoice` / `PlatformPayment` — SaaS money  
- `Tenant` / `User` — post-conversion customer graph  
- `Affiliate*` — channel seed for attribution  
- `AdminAuditLog` / `PlatformSupportAccess` — security & support-access  

### Create only when proven necessary (later phases)

| Family | Why new |
|--------|---------|
| `CrmLead` (+ stage history) | No existing pre-tenant sales entity |
| `CrmActivity` / `CrmTask` / `CrmCall` | AdminAuditLog is not sales activity |
| `CrmDemo` / `CrmProposal` | Tenant quotations are wrong plane |
| `CrmConversion` | Links Lead ↔ Tenant with idempotency |
| `OnboardingProject` / `TrainingProject` | No project domain today |
| `SupportTicket` | Distinct from PlatformSupportAccess |
| `AnalyticsEvent` | No append-only product telemetry |
| `MarketingAttribution` | No campaign model |
| Snapshot tables | Performance for dashboards |

### Explicit non-reuse

| Do not reuse as… | Because |
|------------------|---------|
| Tenant `Client` as Lead | Wrong tenant plane |
| Tenant `Sale` as SaaS revenue | Wrong economic entity |
| Tenant quotation as CRM proposal | Without explicit bridge design |
| PlatformSupportAccess as SupportTicket | Impersonation grants ≠ tickets |

---

## 7. Security & multi-tenant boundaries

1. Platform admins may roll up TENANT_SCOPED metrics **only** with PLATFORM_GLOBAL permission + audit.  
2. Sales users (future) default to LEAD_OWNER / SALES_TEAM scope — not all tenants.  
3. Support impersonation remains SECURITY_RESTRICTED and audited separately from CRM.  
4. Exports require elevated permission + watermark + AdminAuditLog entry.  
5. AI allow-list: only metrics with confirmed sources in `ANALYTICS_GAP_REGISTER.md`.

---

## 8. Internationalisation

Target: all new `/insightbooks/intelligence` and `/insightbooks/crm` UI strings via existing `en`/`ny` locale JSON + language preference — **no English-only architecture**.

Phase 1 finding: admin UI is largely hardcoded; Phase 2 must introduce translation keys before large CRM surface area.

---

## 9. Migration policy

| Phase 1 | No CRM/BI schema migrations |
|---------|-----------------------------|
| Later | Migrations only after model approval; zero data loss; dual-write/reconcile for PlatformPayment backfill if needed |
| Indexes | Add with CRM/event tables; avoid speculative indexes now |

---

## 10. Testing strategy (later phases)

| Layer | Focus |
|-------|-------|
| Unit | SaaS revenue query pack never touches Sale totals |
| Integration | Permission + scope isolation on intel APIs |
| Nav | No System CoA; CRM/intel items permission-gated |
| Conversion | Idempotent Lead→Tenant; no duplicate tenants |
| Events | Duplicate `eventId` rejected |

Existing anchors: `test/systemAdmin.coaRouteRemoval.test.js`, shell nav tests, platform billing / MRA EIS smoke tests.

---

## 11. AI readiness (honest)

| Insight type | Ready? | Prerequisite |
|--------------|--------|--------------|
| Revenue | **Not yet** | Fix G-P0-01/02 + Platform* completeness |
| Customer risk | **Not yet** | Billing signals + usage events + churn reasons |
| Product adoption | **Not yet** | AnalyticsEvent |
| Sales recommendations | **Not yet** | CRM pipeline history |
| Marketing | **Not yet** | Attribution |
| Support | **Not yet** | SupportTicket |
| Infrastructure | **Partial** | Existing health APIs only |

---

## 12. Decisions locked by Phase 1

1. `/insightbooks` = platform control plane only.  
2. SaaS financial truth = Platform billing records (+ careful subscription state).  
3. System Chart of Accounts admin route stays removed.  
4. No CRM/BI feature UI in Phase 1.  
5. No inventing metrics without evidence.  
6. Extend existing models before creating duplicates.  
7. MRA EIS commercial vs entitlement remain distinct (subscription-first unlock already chosen).  

---

## 13. Handoff to Phase 2

Phase 2 may begin **shared foundation** work only after product review of this pack:

- Canonicalise AdminShell navigation  
- Date-range, export dialog, notification centre stubs  
- Permission keys scaffolding (`intel.*`, `crm.*`) without shipping CRM pages  
- i18n key strategy for admin  
- Design (not necessarily ship) SaaS KPI service replacing unsafe dashboard revenue fields  

Do **not** start Lead forms, Kanban, or Executive KPI cards until billing-truth hardening plan is accepted.
