# Phase 6 Scope

## In scope

- Revenue Intelligence workbench under `/insightbooks/intelligence/revenue/*`
- Canonical revenue metric catalogue + governance
- Platform source-of-truth enforcement (Platform* + AccountSubscription)
- Estimated MRR/ARR, reconstruct-then-snapshot, MRR bridge where confidence allows
- Billing, collections, receivables ageing, payment performance, credits/refunds
- MRA EIS **commercial** analytics (plan category), not fiscal EISInvoice
- Retention/cohorts where reconstruct covers the window
- Deterministic contracted/renewal forecast exposure
- Reconciliation workbench + exports (CSV/JSON foundation; XLSX/PDF if helpers exist)
- en/ny, responsive UI, a11y, AuthZ, automated tests

## Out of scope

- Tenant accounting revenue, P&L, GL, Tenant Sale as platform revenue
- Complete customer health scoring; predictive churn ML
- CRM leads/pipeline/proposals; CRM opportunity forecasts
- Marketing attribution; CAC without verified costs; predictive LTV
- AI commentary/recommendations
- Silent FX consolidation; accounting/billing/MRA fiscal workflow changes
