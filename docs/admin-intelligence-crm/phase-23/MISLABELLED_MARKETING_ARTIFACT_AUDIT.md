# Mislabelled Marketing Artifact Audit

| Artifact | Implied meaning | Actual behaviour | Classification |
|----------|-----------------|------------------|----------------|
| CoA / expense "marketing" | Marketing analytics | Tenant GL expense mapping | WRONG_DOMAIN |
| Product Analytics funnels | Acquisition funnel | Product usage funnel | WRONG_DOMAIN |
| Affiliate referral | Marketing referral program | Commission affiliate system | DISCONNECTED |
| Training `marketingAttribution` forbid flags | Attribution feature | Hard-forbid path | CORRECT boundary |
| CRM Lead `source`/`channel` | Campaign attribution | CRM capture evidence strings | EXTEND via mapping — not Campaign SoT |
| Dashboard subscription analytics | Acquisition analytics | Billing charts | WRONG_SCOPE |
| Tree `phase-18` Training | Phase 18 | PRD Phase 22 Training | MISLABELLED_PHASE (known) |

No competing `/insightbooks/marketing` implementations found.
