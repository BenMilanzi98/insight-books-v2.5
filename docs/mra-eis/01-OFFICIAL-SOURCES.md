# 01 — Official Sources

**Retrieved:** 2026-07-22 (InsightBooks workspace snapshot)

## Primary URLs (must re-check before each implementation phase)

| Resource | URL | HTTP (this capture) |
|---|---|---|
| Swagger UI | https://eis-api.mra.mw/swagger/index.html | 200 |
| OpenAPI JSON (production) | https://eis-api.mra.mw/swagger/v1/swagger.json | 200 (~139 KB) |
| OpenAPI YAML (production) | https://eis-api.mra.mw/swagger/v1/swagger.yaml | 200 (~97 KB) |
| OpenAPI JSON (sandbox) | https://dev-eis-api.mra.mw/swagger/v1/swagger.json | 200 (~151 KB) |
| Developer Guide | https://eis-api.mra.mw/docs/ | 200 |
| Sandbox portal (pre-integration) | https://dev-eis-portal.mra.mw/ | (portal; not API) |
| Offline validation base (sample) | `https://dev-eis-portal.mra.mw/ReceiptValidation/Validate/` | From guide offline signing page |
| Online validation example host | `https://eservices.mra.mw/doc/v/` | From sales response sample |

## OpenAPI metadata

| Field | Production | Sandbox |
|---|---|---|
| Spec | OpenAPI 3.0.1 | OpenAPI 3.0.1 |
| `info.title` | EISAPI | EISAPI |
| `info.version` | 1.0 | 1.0 |
| `servers` | empty in JSON | empty in JSON |
| `components.securitySchemes` | **empty** | **empty** |
| Path count | **28** | **31** |

Sandbox-only paths (not in production OpenAPI at capture):

- `POST /api/v1/stock/add-product`
- `GET /api/v1/stock/get-hs-codes`
- `GET /api/v1/stock/get-units-of-measure`

## Local snapshots

Stored under `docs/mra-eis/`:

- `swagger-production.v1.json`
- `swagger-production.v1.yaml`
- `swagger-sandbox.v1.json`
- `guide/` — HTML pages from the developer guide crawl
- `core-schemas.extracted.json` — selected schemas

## Existing InsightBooks code (legacy / incomplete)

Do **not** treat these as the MRA contract of record:

- `lib/eisConfig.js` — endpoint list (partially aligned)
- `lib/eisService.js` — client (partial; auth/signing incomplete vs guide)
- `docs/MRA_EIS_Documentation.md` — **outdated** (describes OAuth `client_credentials` and `/invoices/submit`, which are **not** in current OpenAPI)

## Re-validation checklist (each phase)

- [ ] Re-download production + sandbox `swagger.json`
- [ ] Diff path list against this pack
- [ ] Re-open guide pages for crypto / offline if samples changed
- [ ] Confirm certified `productID` / `productVersion` with MRA
- [ ] Confirm sandbox vs production portal base URLs for QR validation
