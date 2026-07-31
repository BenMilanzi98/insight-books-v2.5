# Terminal Activation Contract

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

## Endpoint

`POST /api/v1/onboarding/activate-terminal` — schema `UnActivatedTerminal`

## Fields

| Field | OpenAPI | Guide |
|---|---|---|
| terminalActivationCode | required string minLength 1 | Mandatory max 50 |
| platform.osName/osVersion | required | Mandatory max 50 |
| platform.osBuild | optional | Optional max 50 |
| platform.macAddress | optional nullable | **Mandatory** 17 chars |
| pos.productID/productVersion | required | Mandatory max 50; certified IDs |

## Response credentials

terminalId, terminalPosition, taxpayerId, activationDate, jwtToken, secretKey, nested Configuration. Sample statusCode=1, remark pending confirmation.

## Retry / timeout recovery

**UNKNOWN / RC:** If MRA activates but client loses response — no documented recovery endpoint. Clarification Q-016 mandatory.

## Phase 1 boundary

Do not enter real TAC into unverified client. No activation performed.

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
