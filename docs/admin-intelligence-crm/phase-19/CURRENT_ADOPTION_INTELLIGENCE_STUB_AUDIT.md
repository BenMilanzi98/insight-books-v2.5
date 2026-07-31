# Current Intelligence / CRM Adoption Stub Audit

**Audited:** 2026-07-31

| Surface | Path | Class | Notes |
|---------|------|-------|-------|
| Intelligence customers adoption page | `app/insightbooks/intelligence/customers/adoption/page.js` | WRONG_DOMAIN / CLIENT_SIDE_ONLY | `CustomerStubView` `sectionKey="adoption"` |
| Customer nav stub | `lib/admin/customerNav.js` | DISCONNECTED | Comment: remaining stubs include adoption |
| Overview pack adoption block | `lib/admin/customers/overviewPack.js` | DISCONNECTED / WRONG_SOURCE | `adoption: { status: UNAVAILABLE, reason: 'FEATURE_USED not emitted' }` |
| Customer 360 adoption block | `lib/admin/customers/customer360.js` | DISCONNECTED / WRONG_SOURCE | Same UNAVAILABLE pattern |
| Customer catalogue code | `lib/admin/customers/catalogue.js` | DISCONNECTED | `ADOPTION: 'customer.adoption'` metric code without spine |
| Customer signals | `lib/admin/customers/signals.js` | DISCONNECTED | Does not emit FEATURE_USED adoption facts |
| Health engagement dimension | `lib/admin/health/dimensions/engagement.js` | WRONG_SOURCE | Login proxy — “not product adoption” |
| KPI catalogue PRODUCT_ADOPTION | `lib/admin/intelligence/kpiCatalogue.js` | DISCONNECTED | Source note: FEATURE_USED events not emitted |
| Permissions intelligence routes | `lib/admin/permissions.js` | EXTEND later | Maps intelligence adoption routes; CS adoption route absent |
| Product-analytics adoption (real) | `lib/admin/productAnalytics/adoption.js` + UI | CORRECT_AND_REUSABLE | Distinct Phase 9 engine — evidence only for Phase 19 |

**Implication:** Phase 19 CS Adoption spine must not read Intelligence stub or CRM `FEATURE_USED not emitted` blocks as Plan/milestone truth. Optional later deep-link from customer 360 to CS Adoption Plan; never invent MET from stub UNAVAILABLE.
