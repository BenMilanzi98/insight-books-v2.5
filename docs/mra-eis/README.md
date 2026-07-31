# MRA EIS — Official API Documentation Pack

**Captured:** 2026-07-22  
**Purpose:** Verified reference for InsightBooks V2 full EIS reimplementation.  
**Status:** Phases 1–4 complete (Phase 4 = control plane).  
**Phase 1:** [phase-1/](./phase-1/) — READY_WITH_OPEN_CLARIFICATIONS  
**Phase 2:** [phase-2/](./phase-2/) — READY_FOR_PHASE_3_WITH_BLOCKERS  
**Phase 3:** [phase-3/](./phase-3/) — READY_FOR_PHASE_4_WITH_BLOCKERS  
**Phase 4:** [phase-4/](./phase-4/) — READY_FOR_PHASE_5_WITH_BLOCKERS

## Start here

1. **Phase 4:** [phase-4/README.md](./phase-4/README.md) → [FINAL_PHASE_4_IMPLEMENTATION_REPORT.md](./phase-4/FINAL_PHASE_4_IMPLEMENTATION_REPORT.md) → [PHASE_5_HANDOVER.md](./phase-4/PHASE_5_HANDOVER.md)
2. **Phase 3:** [phase-3/README.md](./phase-3/README.md) → [FINAL_PHASE_3_ARCHITECTURE_REPORT.md](./phase-3/FINAL_PHASE_3_ARCHITECTURE_REPORT.md)
3. **Phase 2:** [phase-2/README.md](./phase-2/README.md) → [FINAL_PHASE_2_REPORT.md](./phase-2/FINAL_PHASE_2_REPORT.md)
4. **Phase 1:** [phase-1/README.md](./phase-1/README.md) → [FINAL_PHASE_1_REPORT.md](./phase-1/FINAL_PHASE_1_REPORT.md)
3. Pre-pack: [MRA_EIS_OFFICIAL_CONTRACT_REVIEW.md](./MRA_EIS_OFFICIAL_CONTRACT_REVIEW.md) · [04-API-CONTRACT-MATRIX.md](./04-API-CONTRACT-MATRIX.md)
4. Conflicts: [05-DISCREPANCIES-AND-OPEN-QUESTIONS.md](./05-DISCREPANCIES-AND-OPEN-QUESTIONS.md) · [phase-1/DOCUMENTATION_DISCREPANCY_REGISTER.md](./phase-1/DOCUMENTATION_DISCREPANCY_REGISTER.md)

## Documentation index

| Doc | Contents |
|---|---|
| [01-OFFICIAL-SOURCES.md](./01-OFFICIAL-SOURCES.md) | Live URLs, versions, snapshot files |
| [02-SWAGGER-API-REFERENCE.md](./02-SWAGGER-API-REFERENCE.md) | Full OpenAPI endpoint catalogue (prod + sandbox) |
| [03-DEVELOPER-GUIDE-DIGEST.md](./03-DEVELOPER-GUIDE-DIGEST.md) | Auth, crypto, invoice numbers, offline, errors from MRA docs |
| [04-API-CONTRACT-MATRIX.md](./04-API-CONTRACT-MATRIX.md) | Per-endpoint contract matrix (master prompt §5) |
| [05-DISCREPANCIES-AND-OPEN-QUESTIONS.md](./05-DISCREPANCIES-AND-OPEN-QUESTIONS.md) | Swagger vs guide vs legacy InsightBooks |
| [CURRENT_IMPLEMENTATION_AUDIT.md](./CURRENT_IMPLEMENTATION_AUDIT.md) | Existing InsightBooks EIS inventory |
| [MRA_EIS_OFFICIAL_CONTRACT_REVIEW.md](./MRA_EIS_OFFICIAL_CONTRACT_REVIEW.md) | Master-prompt contract review index |
| [MRA_EIS_SWAGGER_DISCREPANCY_REGISTER.md](./MRA_EIS_SWAGGER_DISCREPANCY_REGISTER.md) | Alias → doc 05 |
| [MRA_EIS_IMPLEMENTATION_GAP_REGISTER.md](./MRA_EIS_IMPLEMENTATION_GAP_REGISTER.md) | Gaps before phased build |

## Raw snapshots (do not invent)

| File | Source |
|---|---|
| `swagger-production.v1.json` / `.yaml` | `https://eis-api.mra.mw/swagger/v1/swagger.json` |
| `swagger-sandbox.v1.json` | `https://dev-eis-api.mra.mw/swagger/v1/swagger.json` |
| `guide/*.htm` | Crawl of `https://eis-api.mra.mw/docs/` |
| `core-schemas.extracted.json` | Key OpenAPI schemas extracted from production |

## Environments

| Env | API base | Portal (docs) |
|---|---|---|
| Sandbox / Dev | `https://dev-eis-api.mra.mw` | `https://dev-eis-portal.mra.mw` |
| Production | `https://eis-api.mra.mw` | Confirm at certification |

API version in OpenAPI: **EISAPI 1.0** (`openapi: 3.0.1`).

| | Production | Sandbox |
|---|---|---|
| Path count | 28 | 31 (+ add-product, get-hs-codes, get-units-of-measure) |

## Critical findings (read before any coding)

- **`x-eis-message-hash`:** not in live OpenAPI or guide crawl — do not invent.
- **Invoice number:** official guide uses Base64/Julian components; current `lib/eisConfig.js` decimal format is wrong.
- **Activation `x-signature`:** HMAC-SHA512(TAC, secretKey)→Base64 (known-answer in guide); curl sample that looks like JWT is a doc bug.
- **Success `statusCode`:** samples use `0` and `1` — verify per endpoint in sandbox.
- **Auth:** OpenAPI has no `securitySchemes`; guide samples use raw JWT in `Authorization`.

## Rule before coding

1. Prefer **Swagger** for method/path/schema.  
2. Prefer **Developer Guide** for crypto samples, field comments, offline QR.  
3. Record every conflict in doc 05.  
4. Confirm against sandbox before treating a rule as production-ready.  
5. Never invent endpoints or headers not present in a verified source.  
6. Wait for the next **phased implementation prompt** before writing EIS product code.


## Phase 5
See [phase-5/README.md](./phase-5/README.md) — readiness **READY_FOR_PHASE_6_WITH_BLOCKERS**.


## Phase 6
See [phase-6/README.md](./phase-6/README.md) — readiness **READY_FOR_PHASE_7_WITH_BLOCKERS**.
