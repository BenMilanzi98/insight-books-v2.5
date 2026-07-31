# Phase 3 Scope

## In scope

- Canonical platform role + permission catalogues (versioned)
- Hybrid RBAC + ABAC decision service for `/insightbooks` and `/api/admin/*`
- Scopes: PLATFORM, TENANT, BUSINESS, BRANCH, TEAM, OWNER, SELF, SECURITY_RESTRICTED (CRM scopes stubbed until CRM exists)
- Server enforcement: middleware JWT verify, route permission, API/service/repo helpers
- Field projection / masking (server-side)
- Support access + impersonation governance (real/effective actor)
- SoD, self-escalation prevention, last Super Admin protection
- Privileged session revocation + permission cache invalidation
- Access review / certification scaffolding
- Search / notification / export / report security
- en/ny + a11y for authZ UI surfaces
- Automated denial-matrix tests
- Future intel/crm permission keys as **scaffold only** (routes remain hidden/disabled)

## Out of scope

- MRR/ARR/KPI cards, revenue intelligence, health scores
- Analytics event ingestion
- CRM leads, pipeline, demos, proposals, conversion, onboarding
- AI insights / sales assistant
- New support ticket business workflows
- Billing calculation changes, accounting changes
- Reintroducing `/insightbooks/chart-of-accounts`

## Completion gate (Phase 3)

Same route/API returns only metrics, records, fields, actions, search hits, and exports permitted to the actor — enforced server-side. Hidden UI alone is insufficient.
