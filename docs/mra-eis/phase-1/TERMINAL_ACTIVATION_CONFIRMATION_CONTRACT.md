# Terminal Activation Confirmation Contract

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

## Endpoint

`POST /api/v1/onboarding/terminal-activated-confirmation`

## Signature (written algorithm + known-answer)

| Item | Value | Confidence |
|---|---|---|
| Header | x-signature (required) | VO |
| Algorithm | HMAC-SHA512 | VO |
| Plaintext | Terminal Activation Code (UTF-8) | VO |
| Key | secretKey (UTF-8) | VO |
| Encoding | Standard Base64 | VO |
| KAT | plain=MRA key=123456 → xludP1OafF422HgSRaKqZiUXaFALv8D+mnBJOWd5vDK7N7T22V+WOTvgIFQ7I1p+S2cIPg3JxuVm4xth+8UQ/Q== | VO |

Body: `{ terminalId }`

## Discrepancy

Guide curl sample appears to put JWT-like value in x-signature — **CONFLICT** with prose+KAT. Prefer prose+KAT.

## Verification gate

Sandbox verification still required before production client. KAT can be unit-tested offline without MRA.

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
