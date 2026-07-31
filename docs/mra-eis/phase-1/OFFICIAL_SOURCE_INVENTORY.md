# Official Source Inventory

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

## Classification key

CURRENT · POSSIBLY_CURRENT · SUPERSEDED · ARCHIVED · UNDATED · CONFLICTING · INACCESSIBLE · REQUIRES_CONFIRMATION

## Sources

| Source ID | Title | Publisher | URL | Type | Version | Pub date | Access | Class | Reliability | Local evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| SRC-API-SWAGGER-UI | EISAPI Swagger UI | MRA | https://eis-api.mra.mw/swagger/index.html | API UI | EISAPI 1.0 | UNDATED | 2026-07-22 | CURRENT | High for discovery | probe 200 |
| SRC-API-OAS-JSON | OpenAPI JSON (prod) | MRA | https://eis-api.mra.mw/swagger/v1/swagger.json | OpenAPI 3.0.1 | 1.0 | UNDATED | 2026-07-22 | CURRENT | High for paths/schemas | docs/mra-eis/swagger-production.v1.json SHA256 0DFCC046… |
| SRC-API-OAS-YAML | OpenAPI YAML (prod) | MRA | https://eis-api.mra.mw/swagger/v1/swagger.yaml | OpenAPI | 1.0 | UNDATED | 2026-07-22 | CURRENT | High | swagger-production.v1.yaml |
| SRC-API-OAS-SBX | OpenAPI JSON (sandbox) | MRA | https://dev-eis-api.mra.mw/swagger/v1/swagger.json | OpenAPI | 1.0 | UNDATED | 2026-07-22 | CURRENT | High | swagger-sandbox.v1.json |
| SRC-API-DOCS | EIS API Developers Guide (HTML) | MRA ICT R&I | https://eis-api.mra.mw/docs/ | Guide | v1 (footer 2024) | 2024© | 2026-07-22 | POSSIBLY_CURRENT | High for crypto/process; samples conflict | docs/mra-eis/guide/ |
| SRC-PORTAL-DEV | Developer Resource Center | MRA | https://eis-portal.mra.mw/Home/DeveloperResources | Portal | n/a | UNDATED | 2026-07-22 | CURRENT | Medium (links to swagger/guide) | fetch log |
| SRC-PORTAL-PROD | EIS Taxpayer Portal | MRA | https://eis-portal.mra.mw/ | Portal | n/a | UNDATED | 2026-07-22 | CURRENT | High operational | — |
| SRC-PORTAL-SBX | EIS Sandbox Portal | MRA | https://dev-eis-portal.mra.mw/ | Portal | n/a | UNDATED | 2026-07-22 | CURRENT | High for pre-integration | — |
| SRC-PORTAL-FAQ | EIS Portal FAQ | MRA | https://eis-portal.mra.mw/Home/FAQ | FAQ | UNDATED | UNDATED | 2026-07-22 | CURRENT | Medium | WebFetch 2026-07-22 |
| SRC-NOTICE-TRANS | Public Notice — Transition EFD to EIS | MRA | https://www.mra.mw/admin/storage/download_files/1769007736_003%20TRANSITION%20FROM%20ELECTRONIC%20FISCAL%20DEVICES%20TO%20THE%20ELECTRONIC%20INVOICING%20SYSTEM.pdf | Public Notice | — | Refs Regs 2025 / deadline 31 Jan 2026 | 2026-07-22 | CURRENT | High for transition | evidence/MRA-PublicNotice-EFD-to-EIS-transition.pdf |
| SRC-MRA-HOME | MRA website | MRA | https://www.mra.mw/ | Site | — | — | 2026-07-22 | CURRENT | Lead source | — |
| SRC-MRA-PUB | Publications | MRA | https://www.mra.mw/publications | Index | — | — | 2026-07-22 | CURRENT | Lead | — |
| SRC-MRA-DL | Domestic downloads | MRA | https://www.mra.mw/domestic-downloads | Index | — | — | 2026-07-22 | CURRENT | Lead | — |
| SRC-LEG-VAT-AMEND-2024 | Value Added Tax (Amendment) Act, 2024 (Part II EIS) | Malawi Legislature / as cited by MRA | Locate official gazette text | Legislation | 2024 | 2024 | 2026-07-22 | REQUIRES_CONFIRMATION | Cite via notice; full Act text for counsel | LEGAL_* |
| SRC-LEG-VAT-EIS-REGS-2025 | Value Added Tax (Electronic Invoicing System) Regulations, 2025 | As cited in MRA notice (pub 9 Jan 2026) | Locate gazette | Regulations | 2025 | Cited 9 Jan 2026 | 2026-07-22 | REQUIRES_CONFIRMATION | High if gazette located | LEGAL_* |
| SRC-GUIDE-CERT | API Compliance Certification | MRA | https://eis-api.mra.mw/docs/api_compliance_certification.htm | Guide | v1 | 2024© | 2026-07-22 | POSSIBLY_CURRENT | High process | guide/ |
| SRC-GUIDE-PRE | Developer Pre-Integration Guide | MRA | https://eis-api.mra.mw/docs/developer_pre_integration_guide.htm | Guide | v1 | 2024© | 2026-07-22 | POSSIBLY_CURRENT | High onboarding | guide/ |

## Freshness assessment

- Developer Guide pages carry © 2024; still served live — classed POSSIBLY_CURRENT.
- Transition Public Notice references deadlines through **31 January 2026** and Regulations published **9 January 2026** — CURRENT operational context as of access date.
- OpenAPI `info.version` = **1.0**; no servers array; no securitySchemes — CURRENT snapshot.
- Full VAT Act / Regulations gazette PDFs: **not fully archived in-repo** — counsel must retrieve official instruments.

## Conflicts

See DOCUMENTATION_DISCREPANCY_REGISTER.md (Swagger vs Guide samples).

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
