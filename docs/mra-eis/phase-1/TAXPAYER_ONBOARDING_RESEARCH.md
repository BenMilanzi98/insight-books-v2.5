# Taxpayer Onboarding Research

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

## Sources

- Developer Pre-Integration Guide (sandbox portal `dev-eis-portal.mra.mw`)
- EIS Portal FAQ
- MRA Transition Public Notice

## Documented steps (sandbox / pre-integration)

1. Register on Taxpayers Portal (sandbox for developers).
2. Business registration & verification; TIN/phone/email match Msonkho Online.
3. Select business type: **Product-based** or **Service-based**.
4. Inventory: products (upload/approval) vs services (register under Inventory Management > Services).
5. Branch/site setup; warehouse → branch transfers (FAQ).
6. Terminal application → TAC issuance (portal process).
7. Activate software with TAC via API; confirm activation.
8. Sync approved products/services to POS.
9. First test transactions in sandbox; later certification & production.

## Differences

| Dimension | Notes | Confidence |
|---|---|---|
| Product vs service | Services registered on portal; products via inventory upload/mapping; sync via get-terminal-site-products | Official guide |
| Mixed businesses | Not fully specified — ${conf.RC} |
| VAT vs non-VAT | taxpayerConfiguration.isVATRegistered in activation config | OpenAPI |
| Single vs multi-site | terminalSite / siteId; FAQ branch transfers | Official |

Do **not** assume identical workflows for all taxpayers.

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
