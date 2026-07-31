# MRA EIS Payment Plans — Program Index

**Status:** Phase 1 foundation complete (2026-07-28) · Modeling **A** · Entitlement **subscription-first**  
**Locked:** Plan modeling **A** · Entitlement **subscription-first**  
**Shipped in Phase 1:** `PlatformPlanVersion` MRA_EIS fields + migration · `lib/admin/mraEisPlans.js` · PayChangu server-side price + category coexistence + entitlement-pending · Admin API/UI `/insightbooks/billing/mra-eis-plans` · smoke tests  
**Next gate:** Phase 2 — public pricing polish, tenant checkout lifecycle, trials/upgrades.

## Business distinction (locked)

| Concept | Meaning |
|---------|---------|
| InsightBooks Core Subscription | Access to the main SaaS platform |
| MRA EIS Subscription | Paid commercial plan for MRA EIS features |
| MRA EIS Entitlement | Compliance/authorization to set up and use EIS |
| MRA EIS Operational Configuration | Credentials, terminals, mappings, transmission |

Relationship (target):

```
MRA EIS PLAN → MRA EIS SUBSCRIPTION → MRA EIS ENTITLEMENT
  → TENANT CONFIGURATION → TERMINAL ACTIVATION → OPERATIONAL USE
```

Payment must not silently grant operational readiness. Entitlement must not silently mark an unpaid subscription active.

## Audit documents

| Document | Purpose |
|----------|---------|
| [CURRENT_IMPLEMENTATION_AUDIT.md](./CURRENT_IMPLEMENTATION_AUDIT.md) | Cross-cutting inventory |
| [SUBSCRIPTION_ARCHITECTURE_AUDIT.md](./SUBSCRIPTION_ARCHITECTURE_AUDIT.md) | AccountSubscription / EIS plans |
| [BILLING_ARCHITECTURE_AUDIT.md](./BILLING_ARCHITECTURE_AUDIT.md) | Platform* ledger |
| [MRA_EIS_ENTITLEMENT_AUDIT.md](./MRA_EIS_ENTITLEMENT_AUDIT.md) | Compliance control plane |
| [PUBLIC_LANDING_PAGE_AUDIT.md](./PUBLIC_LANDING_PAGE_AUDIT.md) | Marketing / pricing |
| [TENANT_SUBSCRIPTION_UI_AUDIT.md](./TENANT_SUBSCRIPTION_UI_AUDIT.md) | Tenant `/subscription` |
| [SYSTEM_ADMIN_UI_AUDIT.md](./SYSTEM_ADMIN_UI_AUDIT.md) | `/insightbooks/billing` |
| [PAYMENT_GATEWAY_AUDIT.md](./PAYMENT_GATEWAY_AUDIT.md) | PayChangu |
| [INVOICE_GENERATION_AUDIT.md](./INVOICE_GENERATION_AUDIT.md) | Platform invoices |
| [PLAN_LIMIT_AUDIT.md](./PLAN_LIMIT_AUDIT.md) | Limits / usage |
| [FEATURE_ENTITLEMENT_AUDIT.md](./FEATURE_ENTITLEMENT_AUDIT.md) | Feature flags vs EIS |
| [TRIAL_AND_PROMOTION_AUDIT.md](./TRIAL_AND_PROMOTION_AUDIT.md) | Trials / discounts |
| [UPGRADE_DOWNGRADE_AUDIT.md](./UPGRADE_DOWNGRADE_AUDIT.md) | Plan changes |
| Risk registers | Duplicate billing/subscription, entitlement, multi-tenant, security |
| [RESPONSIVE_UI_AUDIT.md](./RESPONSIVE_UI_AUDIT.md) | Responsive gaps |
| [TEST_COVERAGE_AUDIT.md](./TEST_COVERAGE_AUDIT.md) | Existing tests |
| [FINAL_GAP_REGISTER.md](./FINAL_GAP_REGISTER.md) | Prioritized gaps |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Phased delivery |

## Classification legend

`KEEP` · `REUSE` · `EXTEND` · `REFACTOR` · `REIMPLEMENT` · `CONSOLIDATE` · `DUPLICATED` · `DISCONNECTED` · `INCOMPLETE` · `INCORRECT` · `UNSAFE` · `DUPLICATE_BILLING_RISK` · `DUPLICATE_SUBSCRIPTION_RISK` · `ENTITLEMENT_RISK` · `CROSS_TENANT_RISK` · `BLOCKED` · `NOT_APPLICABLE`

## Non-negotiables (from master prompt)

- No hardcoded public EIS prices in UI once plans are admin-configurable
- No silent edits to published plan prices (versioning required)
- Zero duplicate trials / subscriptions / invoices / payments
- Platform invoices ≠ tenant sales invoices
- Subscription active ≠ MRA EIS ready
