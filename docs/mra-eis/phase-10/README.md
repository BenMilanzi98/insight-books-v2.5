# Phase 10 — MRA Product & Service Catalogue Sync and Mapping

**Decision:** `READY_FOR_PHASE_11_WITH_BLOCKERS`

## Entry
- Services: `lib/mraEis/application/catalogue/`
- Mock: `lib/mraEis/infrastructure/mraClient/mockMraCatalogueServer.js`
- Client: `catalogueClient.js`
- Tenant UI: `/settings/integrations/mra-eis/catalogue`
- Admin UI: `/insightbooks/mra-eis/catalogue`
- APIs: `/api/mra-eis/catalogue/**`

## Hard rules
- External catalogue never auto-creates local Products/Services
- Sync never mutates local stock, prices, or taxes
- Suggestions never auto-activate
- Product sync HTTP method unresolved (Q-003) — production blocked; MOCK POST only
- Initial Inventory submission blocked until contract verified
- Cross-type Product↔Service blocked by default
- Bundles require MRA clarification

---
*Phase 10 implementation. External catalogue ≠ local master data. Suggestions never auto-activate. No Sale/fiscal number/QR. No Journal/Stock/price/tax auto-mutation. Product sync method Q-003 blocked for production. Initial Inventory upload blocked until verified. Cross-type mappings blocked by default.*
