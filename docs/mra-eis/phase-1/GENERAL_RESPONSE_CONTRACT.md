# General Response Contract

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

## Envelope (OpenAPI)

`statusCode` (int32), `remark` (string|null), `data` (varies), `errors` (APIError[]|null)

APIError: `errorCode`, `fieldName`, `errorMessage`

## Success rules

| Observation | Confidence |
|---|---|
| Activation samples use statusCode **1** | Official sample |
| Sales sample uses statusCode **0** | Official sample |
| HTTP 200 may still carry business failure via errors/remark | INF — must verify |
| Do not define success as HTTP 200 alone | Engineering rule from Phase 1 prompt + ambiguity |

Sales-specific flags in data: validationURL, shouldDownloadLatestConfig, shouldBlockTerminal, validationErrors.

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
