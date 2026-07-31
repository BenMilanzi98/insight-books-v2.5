# Swagger Forensic Report

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

## Inspection

| Item | Result |
|---|---|
| Swagger UI | https://eis-api.mra.mw/swagger/index.html — HTTP 200 |
| OpenAPI JSON | /swagger/v1/swagger.json — HTTP 200, application/json |
| OpenAPI YAML | /swagger/v1/swagger.yaml — available (archived) |
| Title / version | EISAPI / 1.0 |
| openapi | 3.0.1 |
| servers | empty object/array in JSON |
| securitySchemes | **empty** |
| Paths (prod) | 28 |
| Paths (sandbox) | 31 (3 sandbox-only) |
| Schemas (prod) | 94 |
| Custom header params | x-signature on confirmation only |

## Method

Safe public GET of published OpenAPI. No auth bypass. Checksums in evidence/SOURCE_CHECKSUMS.md.

## Conclusion

OpenAPI document **is available** (contrary to failure case in prompt). Auth/hash rules incomplete in OpenAPI — guide required.

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
