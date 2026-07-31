# General Request Contract

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

## Verified headers

| Header | Evidence | Required when | Confidence |
|---|---|---|---|
| Content-Type: application/json | OpenAPI + guide curls | Bodies present | VO |
| Accept | Guide samples text/plain | Optional in samples | OA |
| Authorization | Guide curls (raw JWT) | Post-activation | OI (Bearer vs raw) |
| x-signature | OpenAPI required param | Activation confirmation only | VO |
| x-eis-message-hash | **Not in OpenAPI/guide crawl** | — | Unverified / RC |
| x-access-key | Not in OpenAPI | — | Unverified / RC |

## Serialization

| Topic | Finding | Confidence |
|---|---|---|
| JSON property casing | camelCase in schemas | VO |
| additionalProperties | false on core sales schemas | VO |
| Date-time | format date-time on invoiceDateTime | VO |
| Decimals | number/double — scale undocumented | RC |
| Hash canonicalization | Not defined for general requests | RC |
| Empty body hashing | N/A until message-hash proven | RC |

**Do not implement production signing while message-hash input unresolved.**

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
