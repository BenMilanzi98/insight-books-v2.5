# CRM Gap Register

**Audited:** 2026-07-28  
**PRD lifecycle:** Marketing → Lead → Qualify → Demo → Proposal → Won → Tenant → Subscription → Onboarding → Training → Health → Renewal

## Workflow status

| Workflow | Exists today? | Evidence | Gap |
|----------|---------------|----------|-----|
| Lead capture (web/WhatsApp/manual) | **No domain model** | No Prisma Lead*; WhatsApp CTA only; `POST /api/contact/demo-request` emails hard-coded inbox — **does not persist** a Lead | New Lead intake + idempotency |
| Lead qualification / scoring | **No** | `NOT_FOUND` | New scoring rules + fields |
| Sales pipeline / stages | **No** | `NOT_FOUND` | New Pipeline + stage history |
| Activities / notes / calls / tasks | **No CRM activity model** | AdminAuditLog ≠ sales activity | New activity domain |
| Calendar / demos | **No** | `NOT_FOUND` | Demo scheduling + calendar |
| Proposals / quotations (sales) | **No platform proposal** | Tenant quotations exist under tenant app — **must not** reuse as CRM proposals without explicit bridge | New Proposal model |
| Lead → Tenant conversion | **Partial human process** | Admin can create tenants (`/api/admin/tenants`) but no Lead linkage | Conversion transaction + audit |
| Onboarding projects | **No CRM onboarding** | `BusinessSetupRun` / `BusinessSetupStep` = tenant accounting setup wizard — **not** sales onboarding | New CRM onboarding domain |
| Training projects | **No** | `NOT_FOUND` | New training domain |
| Sales team / ownership | **No sales-owner model** | Admin roles exist; no lead-owner assignment | Sales RBAC + ownership |
| Sales forecasting | **No** | `NOT_FOUND` | Needs pipeline + closed-won history |
| Customer success health | **No** | `NOT_FOUND` | Needs usage + billing signals |
| Support desk | **No ticket model** | `PlatformSupportAccess` is impersonation/support-access, not ticketing | Separate SupportTicket domain |

## What CAN be reused as CRM inputs (not CRM itself)

| Asset | Reuse as | Class |
|-------|----------|-------|
| `Tenant` + lifecycle APIs | Converted customer record | `REUSE` |
| `AccountSubscription` / Platform billing | Post-win commercial state | `REUSE` |
| `Affiliate` / referrals | Channel attribution seed | `EXTEND` |
| `Admin` + permissions | Sales roles foundation | `EXTEND` |
| `AdminAuditLog` / support-access | Compliance for conversion/impersonation | `REUSE` |
| Email platform templates | Sales email templates later | `EXTEND` |
| Public signup / trial | Downstream of Won — not lead capture | `REUSE` |

## Idempotency requirements (future)

Must prevent duplicate: Leads, Activities, Tasks, Proposals, Conversions, Tenants, Subscriptions, Onboarding projects, Notifications.

## Priority for implementation (post Phase 1)

1. CRM foundation + Lead capture (PRD Phase 14)  
2. Qualification + Pipeline (15–16)  
3. Activities / demos / proposals (17–19)  
4. Conversion → Tenant with billing hooks  
5. Onboarding / training  
6. Health / retention (depends on analytics instrumentation)

## Explicit non-reuse

Do **not** treat Tenant `Client` / sales `Invoice` as CRM leads or SaaS customers.
