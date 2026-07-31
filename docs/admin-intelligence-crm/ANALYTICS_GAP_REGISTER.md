# Analytics Gap Register

**Audited:** 2026-07-28  
**Rule:** Do not claim a metric is available without a confirmed source.

## Metric readiness matrix

| Metric / question (PRD) | Available now? | Confirmed source | Caveats | Class |
|-------------------------|----------------|------------------|---------|-------|
| Active tenants | **Likely yes** | `Tenant` status counts via admin dashboard APIs | Define “active” precisely | `REUSE` |
| New tenants in period | **Likely yes** | `Tenant.createdAt` | Timezone / trial vs paid | `REUSE` |
| Trial vs paid mix | **Partial** | `AccountSubscription` isTrial / plan | Multiple subscriptions per tenant (core+EIS) | `EXTEND` |
| SaaS MRR / ARR | **Partial — estimated** | `lib/admin/saasBillingKpis.js` → dashboard + billing overview | Yearly÷12; CORE+EIS coexistence; not full ARR/churn | `EXTEND` |
| Platform payments collected | **Yes (ledger path)** | `PlatformPayment` via `ensurePaychanguPlatformLedger` on PayChangu success + historical backfill | Prefer payment cash when invoices sparse; unmatched orphans rare/manual | `REUSE` |
| Active subscription counts (overview) | **Fixed filter** | `activeCommercialSubscriptionWhere` / paid where | Includes `Completed` + expiresAt | `REUSE` |
| Churn / cancellations | **Weak** | Expiry / isActive flips on `AccountSubscription` | No first-class churn reason model | `INSTRUMENTATION_REQUIRED` |
| MRA EIS commercial subscribers | **Yes** | `AccountSubscription` where plan in EIS ids | ≠ entitlement ready | `REUSE` |
| MRA EIS entitled tenants | **Yes** | `MraEisTenantEntitlement` current status | Compliance plane | `REUSE` |
| Feature adoption (POS/invoice/…) | **No product event store** | Ad-hoc table counts possible but heavy | Needs AnalyticsEvent or daily snapshots | `INSTRUMENTATION_REQUIRED` |
| Customer health score | **No** | — | Needs usage + support + billing signals | `NOT_FOUND` |
| Lead volume / conversion rate | **No** | — | No Lead model | `NOT_FOUND` |
| Sales pipeline value | **No** | — | No Opportunity | `NOT_FOUND` |
| Demo show rate | **No** | — | No Demo | `NOT_FOUND` |
| Marketing attribution | **No** | — | No CampaignAttribution; WhatsApp link only | `NOT_FOUND` |
| Support SLA / ticket volume | **No** | — | No SupportTicket | `NOT_FOUND` |
| Infrastructure uptime | **Partial** | `/api/admin/system-health`, performance routes | Not full infra monitoring | `INCOMPLETE` |
| Security incidents | **Partial** | Security monitoring APIs + SecV2 / audit | Not unified “intelligence” layer | `EXTEND` |
| Affiliate-driven revenue | **Partial** | AffiliateReferral / commissions | Attribution to MRR needs join rules | `EXTEND` |
| AI recommendations | **Not ready** | — | Evidence incomplete for most domains | `BLOCKED` until sources exist |

## Existing analytics surfaces (to verify depth in CURRENT_SYSTEM_AUDIT)

| Surface | Path / API | Status |
|---------|------------|--------|
| Admin dashboard control tower | `/insightbooks/dashboard` + `/api/admin/dashboard/stats` | Present — verify metric definitions |
| Analytics API | `/api/admin/analytics` | Present — verify payloads |
| Engagement | `/api/admin/analytics/engagement` | Present — verify |
| Revenue overview page | `/insightbooks/dashboard/revenue-overview` | Page exists — verify not using Tenant sales |
| Subscription analytics pages | dashboard subroutes | Pages exist — verify sources |
| Platform reports | `/api/admin/platform-reports`, `/insightbooks/reports` | Present — verify |
| Mobile app analytics | `/api/admin/mobile-app/analytics` | Present — app-scoped |

## Instrumentation required before claiming readiness

1. Append-only `AnalyticsEvent` (or equivalent) with idempotency keys  
2. Daily tenant activity snapshots (login, key module use)  
3. Canonical churn / suspension reason codes  
4. ~~Guaranteed PlatformPayment write on every successful PayChangu activation~~ **Done** (`paychanguPlatformLedger` + backfill)  
5. Lead + pipeline tables for sales metrics  
6. Explicit “SaaS revenue query pack” that never joins Tenant Invoice totals (`saasBillingKpis` started; keep extending)
