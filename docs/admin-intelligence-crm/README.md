# Admin Intelligence Command Centre & Sales CRM — Phase 1

**Status:** Phase 1 discovery pack **complete** (2026-07-28) — awaiting product review before Phase 2  
**Source PRD:** `Inteligence & Leads.txt`  
**Boundary:** Discovery & architecture only — **no feature implementation**, no production behaviour changes, no migrations unless explicitly approved.

## Classification legend

`KEEP` · `REUSE` · `EXTEND` · `REFACTOR` · `REIMPLEMENT` · `CONSOLIDATE` · `DUPLICATED` · `DISCONNECTED` · `INCOMPLETE` · `INCORRECT` · `UNSAFE` · `NOT_FOUND` · `INSTRUMENTATION_REQUIRED` · `BLOCKED`

## Scope principles (locked)

| Principle | Rule |
|-----------|------|
| Control plane | `/insightbooks` manages platform ops — not Tenant GL posting |
| Financial truth | Platform billing records = SaaS revenue (not Tenant sales) |
| COA route | `/insightbooks/chart-of-accounts` must stay removed from nav/use |
| Multi-tenant | No Cross-Tenant exposure in future analytics |
| AI | Evidence-based only — no invented metrics |

## Deliverables

| Document | Purpose |
|----------|---------|
| [CURRENT_SYSTEM_AUDIT.md](./CURRENT_SYSTEM_AUDIT.md) | Cross-cutting inventory |
| [ROUTE_INVENTORY.md](./ROUTE_INVENTORY.md) | All `/insightbooks` routes + target CRM/intel routes |
| [COMPONENT_INVENTORY.md](./COMPONENT_INVENTORY.md) | Admin UI kit / shells |
| [DATA_SOURCE_INVENTORY.md](./DATA_SOURCE_INVENTORY.md) | Metric → source mapping |
| [DATABASE_MODEL_AUDIT.md](./DATABASE_MODEL_AUDIT.md) | Prisma models relevant to BI/CRM |
| [EVENT_TRACKING_AUDIT.md](./EVENT_TRACKING_AUDIT.md) | Telemetry / analytics events |
| [ANALYTICS_GAP_REGISTER.md](./ANALYTICS_GAP_REGISTER.md) | Metrics available vs missing |
| [CRM_GAP_REGISTER.md](./CRM_GAP_REGISTER.md) | Lead→CRM workflow gaps |
| [PERMISSION_AUDIT.md](./PERMISSION_AUDIT.md) | systemAdmin.* permissions |
| [MULTI_TENANT_RISK_REGISTER.md](./MULTI_TENANT_RISK_REGISTER.md) | Scope / isolation risks |
| [DUPLICATION_RISK_REGISTER.md](./DUPLICATION_RISK_REGISTER.md) | Duplicate domain / billing risks |
| [SECURITY_RISK_REGISTER.md](./SECURITY_RISK_REGISTER.md) | AuthZ / impersonation / audit |
| [PERFORMANCE_RISK_REGISTER.md](./PERFORMANCE_RISK_REGISTER.md) | Query / aggregation risks |
| [FINAL_GAP_REGISTER.md](./FINAL_GAP_REGISTER.md) | Prioritised gaps |
| [TARGET_ARCHITECTURE.md](./TARGET_ARCHITECTURE.md) | Safe target architecture |

## Completion gate

Phase 1 is complete only when every requested metric and CRM workflow has a **confirmed source** or a documented **instrumentation requirement**.

| Gate check | Document |
|------------|----------|
| Metrics | [ANALYTICS_GAP_REGISTER.md](./ANALYTICS_GAP_REGISTER.md) |
| CRM workflows | [CRM_GAP_REGISTER.md](./CRM_GAP_REGISTER.md) |
| Prioritised gaps + order | [FINAL_GAP_REGISTER.md](./FINAL_GAP_REGISTER.md) |
| Target architecture | [TARGET_ARCHITECTURE.md](./TARGET_ARCHITECTURE.md) |

## Critical finding (do not ignore)

`/api/admin/dashboard/stats` aggregates Tenant `Sale`/`Expense` as platform “revenue/profit”. That is **`UNSAFE`** for SaaS BI. Platform billing (`PlatformInvoice` / `PlatformPayment` / related) is the financial source of truth.

## Non-goals this phase

Executive KPI cards, CRM UI, lead forms, pipelines, AI insights, new support workflows, schema migrations for CRM.

## Review checklist (before Phase 2)

- [ ] Product accepts SaaS revenue = Platform billing (not Tenant sales)
- [ ] Product accepts CRM as net-new domain (no Lead models today)
- [ ] Product accepts safest order in `FINAL_GAP_REGISTER.md` § implementation order
- [ ] Explicit approval before any schema migration or BI/CRM UI work
