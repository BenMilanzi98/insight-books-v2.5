# 05 — Discrepancies & Open Questions

**Captured:** 2026-07-22  
**Also serves as:** `MRA_EIS_SWAGGER_DISCREPANCY_REGISTER.md` (master prompt name)

Severity: **BLOCKER** (must resolve before that feature ships) · **HIGH** · **MEDIUM** · **LOW**

---

## 1. Register

| ID | Severity | Topic | Swagger / Official API | Developer Guide | InsightBooks legacy / master prompt | Resolution rule |
|---|---|---|---|---|---|---|
| D-001 | BLOCKER | Request integrity header `x-eis-message-hash` | **Not present** in OpenAPI parameters or schemas | **Not found** in guide crawl | Master prompt §14 requires it for requests except activation | **Do not implement** until sandbox proves required or MRA confirms. Re-check swagger each phase. |
| D-002 | BLOCKER | Invoice number format | Opaque string `invoiceNumber` | Base64(TaxpayerID)-Base64(TerminalPosition)-Base64(JulianDate)-Base64(Count) with Julian algorithm in C# sample | `lib/eisConfig.js` uses `TIN-pos-YYYYMMDD-seq` (decimal) | Prefer **guide algorithm**; rewrite generator; add known-answer tests from guide samples |
| D-003 | HIGH | Activation `x-signature` sample vs prose | Header required | Prose + known-answer = HMAC-SHA512(TAC, secretKey)→Base64; curl sample value looks like a **JWT** | Partial `x-signature` support in `eisService` | Trust **prose + known-answer**; ignore JWT-in-signature curl as doc bug |
| D-004 | HIGH | Success `statusCode` | Integer in envelope | Activation samples use `1`; sales sample uses `0` | May assume single success code | Treat success as **endpoint-specific**; verify in sandbox; map both until clarified |
| D-005 | HIGH | Auth header format | No `securitySchemes` | Samples: `Authorization: <raw JWT>` without `Bearer ` | Master prompt mentions Bearer JWT | Test sandbox: raw vs `Bearer `; document winner |
| D-006 | MEDIUM | `get-latest-configs` method | **POST** | Sample **GET** | `eisConfig` uses POST path (good) | Call **POST** |
| D-007 | MEDIUM | Duplicate path in samples | Canonical `/api/v1/...` | Some samples `/api/v1/api/v1/...` | — | Use Swagger path once |
| D-008 | MEDIUM | MAC address | Optional in OpenAPI | Guide: Mandatory, 17 chars | — | Send valid MAC in activation; confirm rejection if omitted |
| D-009 | MEDIUM | Line item / paymentMethod requiredness | Many line fields not in OpenAPI `required` | Guide comments mark several Mandatory | Legacy validation incomplete | Build field matrix from guide field tables + sandbox reject messages |
| D-010 | MEDIUM | General HMAC “of payload” | Only confirmation header in OpenAPI | §3.4 says signature from payload + secretKey | Master prompt “secret-key-based request integrity” | Likely refers to confirmation + offline; do not invent sales request HMAC headers |
| D-011 | LOW | Offline limit spelling | `maxCummulativeAmount` | Same misspelling likely | — | Preserve OpenAPI property names exactly |
| D-012 | LOW | Sandbox-only stock helpers | Absent in prod OpenAPI | — | — | Gate by environment |
| D-013 | HIGH | Legacy docs `docs/MRA_EIS_Documentation.md` | — | — | OAuth `client_credentials`, `/invoices/submit` — **not in current API** | Treat as historical; do not use for implementation |
| D-014 | MEDIUM | Business fields on Tenant | — | Terminal JWT + secretKey | `eisApiKey` / `eisClientSecret` OAuth-style naming | Re-model secrets to terminal credentials in reimplementation |
| D-015 | MEDIUM | Confirmation auth | — | Sample omits separate Authorization; signature only | — | Confirm whether JWT also required on confirmation |

---

## 2. Open questions for MRA / sandbox

1. Is any header besides `Authorization` and (confirmation) `x-signature` required on sales submit?
2. Exact success `statusCode` values per endpoint.
3. Is `Authorization` raw JWT or `Bearer <jwt>`?
4. Exact Base64 integer encoding for invoice number (padding, alphabet, endianness of integer→bytes).
5. Exact offline query-string field order and URL encoding for HMAC-SHA256.
6. Certified InsightBooks `productID` / `productVersion` for sandbox and production.
7. Production portal validation URL host vs sandbox `dev-eis-portal` / `eservices.mra.mw`.
8. Idempotency when resubmitting same `invoiceNumber`.
9. Whether confirmation endpoint requires JWT in addition to `x-signature`.

---

## 3. Decision log (fill during phases)

| Date | Decision | Evidence |
|---|---|---|
| 2026-07-22 | Documentation pack frozen from live swagger/guide; no EIS code changes this phase | This folder |
| | | |
