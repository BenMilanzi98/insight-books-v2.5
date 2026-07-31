# Product Split — CORE vs MRA EIS

## Rule

- **Combined** estimated platform contracted MRR = sum of CORE + MRA EIS commercial MRR (same currency bucket).
- **Split** every recurring metric where plan product is known.
- Mapping: `PlatformPlanVersion.planCategory` when available; else plan code heuristics from `lib/admin/mraEisPlans.js` / subscription config EIS plan codes.
- A tenant may contribute to **both** CORE and EIS MRR (two rows) — distinctActivePaidTenants remains distinct tenants; subscription row counts may exceed tenants (documented limitation).

## Not product revenue

- `MraEisTenantEntitlement` counts = entitlement, not MRR.
- Tenant fiscal `EISInvoice` = tenant customer tax documents, **not** platform SaaS revenue.
