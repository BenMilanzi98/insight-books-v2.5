# EP-ONB-01: Activates a terminal

**Access date:** 2026-07-22  
**Environment scope:** Production + Sandbox OpenAPI  
**Confidence:** VERIFIED_OFFICIAL (OpenAPI path/method/schema names); auth/hash/retry behavioural details OFFICIAL_BUT_AMBIGUOUS pending sandbox

## Purpose
Activates a terminal

## Preconditions
- Terminal activated and confirmed (except activate-terminal)
- Valid JWT for authenticated endpoints (guide samples; OpenAPI declares no securitySchemes)
- Authorized sandbox credentials required before any live call (Phase 1: **not executed**)

## Business process
See Phase 1 domain contracts. This sheet is the OpenAPI-derived technical contract.

## Method
`POST`

## Route
`/api/v1/onboarding/activate-terminal`

## Headers
| Header | OpenAPI |
|---|---|
| Content-Type | application/json (where body present) |
| Authorization | Guide-only JWT; not declared in OpenAPI securitySchemes |
| Custom | -

## Request schema
- Content types: application/json|text/json|application/*+json
- Schema: `#/components/schemas/UnActivatedTerminal`

## Response schema
- Declared HTTP responses: 200, 500
- Typical envelope: statusCode, remark, data, errors[] (APIError)

## Success examples
Sanitized placeholders only — see CONTRACT_FIXTURE_PLAN.md. Do not commit sample JWT/secretKey.

## Validation / Business / HTTP errors
OpenAPI HTTP codes: 200, 500. Application error catalogue: ERROR_CODE_CATALOGUE.md + guide error_codes.

## Authentication
None (pre-credential)

## Hashing
`x-eis-message-hash`: **NOT in OpenAPI** — Unverified. Do not send until proven.

## Signing
No OpenAPI signature header

## Retry policy / Idempotency / Timeout
UNKNOWN pending sandbox — see IDEMPOTENCY_AND_DUPLICATE_RESEARCH.md and TIMEOUT_AND_UNKNOWN_OUTCOME_RESEARCH.md. Mutating POSTs unsafe until proven.

## Security considerations / Sensitive fields
May involve JWT, secretKey, TIN, buyer auth codes, VAT5 — see PRIVACY_AND_DATA_CLASSIFICATION.md

## Audit requirements
Log metadata without secrets; retain fiscal evidence per DATA_RETENTION_AND_AUDIT_RESEARCH.md

## Sandbox test cases
Planned only — SANDBOX_VERIFICATION_PLAN.md. **Not executed in Phase 1.**

## Known discrepancies
DOCUMENTATION_DISCREPANCY_REGISTER.md; parent pack docs/mra-eis/05-DISCREPANCIES-AND-OPEN-QUESTIONS.md

## Open questions
MRA_CLARIFICATION_REGISTER.md

## Implementation recommendation
Contract only in Phase 1. No client implementation.

## Sources
- OpenAPI: docs/mra-eis/swagger-production.v1.json
- Guide: https://eis-api.mra.mw/docs/
