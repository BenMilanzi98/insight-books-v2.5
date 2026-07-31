# Cryptographic Requirements

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

## Operations

### 1. Activation confirmation signature

| Attribute | Value | Status |
|---|---|---|
| Purpose | Confirm activation | Verified algorithm |
| Algorithm | HMAC-SHA512 | Known |
| Input | TAC string | Known |
| Key | secretKey | Known |
| Output | Standard Base64 | Known |
| Official KAT | Yes (MRA/123456) | Pass requirement for offline unit test |
| Sandbox validation | Pending | Not VERIFIED_BY_SANDBOX |

### 2. General message hash (x-eis-message-hash)

| Attribute | Value | Status |
|---|---|---|
| Presence in OpenAPI | Absent | BLOCKING ambiguity |
| Presence in guide crawl | Not found as header name | BLOCKING |
| Master prompt claim | Required except activation | Unverified |
| Implementation | **FORBIDDEN until proven** | — |

### 3. Offline signature

| Attribute | Value | Status |
|---|---|---|
| Algorithm | HMAC-SHA256 | Guide |
| Input | Query-parameter string (invoice fields) | Partial — order/format RC |
| Output | URL-safe Base64 | Guide |
| Field | invoiceSummary.offlineSignature | OpenAPI |
| Official reproducible example | Incomplete in this pack | BLOCK offline impl until KAT |

### 4. Fiscal number Base64 components

See FISCAL_NUMBERING_CONTRACT.md — algorithm documented; independent reproduction pending exact integer→Base64 rules.

## Gate

A crypto contract is VERIFIED only when algorithm+input+serialization+encoding+expected output+test vector pass.

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
