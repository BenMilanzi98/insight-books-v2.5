# 04 — API Contract Matrix

**Captured:** 2026-07-22  
**Swagger source:** `swagger-production.v1.json` / `swagger-sandbox.v1.json`  
**Docs source:** `https://eis-api.mra.mw/docs/` (local `guide/`)  
**API version:** EISAPI **1.0**  
**Environments:** Sandbox `https://dev-eis-api.mra.mw` · Production `https://eis-api.mra.mw`

## Legend

| Symbol | Meaning |
|---|---|
| **Verified** | Present in OpenAPI and/or guide with consistent meaning |
| **Guide-only** | In developer guide / samples, not in OpenAPI parameters |
| **OpenAPI-only** | In OpenAPI, not clearly in guide samples |
| **Unverified** | Claimed in InsightBooks master prompt or legacy docs; **not** found in live OpenAPI/guide |
| **Conflict** | Sources disagree — resolve in sandbox before coding |
| **Pending** | Requires sandbox call / MRA clarification |
| `*` | OpenAPI marks parameter required |

### Cross-cutting defaults (unless row overrides)

| Field | Default contract |
|---|---|
| Request content type | `application/json` (also `text/json`, `application/*+json` in OpenAPI) |
| Response content type | JSON envelope (`*APIResponse`) unless noted |
| Authentication | **None** for activate-terminal; **JWT in `Authorization`** (Guide-only; raw token in samples, Bearer prefix Unverified) for post-activation calls |
| Message-hash (`x-eis-message-hash`) | **Unverified** — not in OpenAPI; not found in guide HTML crawl. Do **not** send until sandbox proves required |
| Signature | Only OpenAPI-required custom header: `x-signature` on activation confirmation |
| Success criteria | HTTP 200 + business `statusCode` / `remark` / `data` — **Conflict** on numeric success (`0` vs `1`) |
| Retry safety | Assume **unsafe** for mutating POSTs until idempotency proven |
| Idempotency | **Pending** (not documented in OpenAPI) |
| Timeout | InsightBooks client default TBD; MRA SLA not in OpenAPI |
| Sandbox result | **Pending** (no live contract tests run in this docs phase) |
| Contract-test status | **Not started** |
| MRA clarification status | See `05-DISCREPANCIES-AND-OPEN-QUESTIONS.md` |

---

## A. Onboarding

### A1. Activate Terminal

| Attribute | Value |
|---|---|
| Official name | Activates a terminal |
| Group | OnBoarding |
| Method / Path | `POST /api/v1/onboarding/activate-terminal` |
| Auth | None (pre-credential) |
| Required headers | (none in OpenAPI) |
| Message-hash | No (Unverified elsewhere) |
| Signature | No |
| Request schema | `UnActivatedTerminal` |
| Response schema | `TerminalActivationResponseAPIResponse` → `TerminalActivationResponse` |
| Required fields (OpenAPI) | `terminalActivationCode`; `environment.platform.osName`, `osVersion`; `environment.pos.productID`, `productVersion` |
| Optional (OpenAPI) | `osBuild`, `macAddress` |
| Field limits (Guide) | TAC max 50; osName/osVersion/osBuild max 50; macAddress **17 chars** format `01-23-45-67-89-AH` (**Conflict:** guide Mandatory vs OpenAPI optional); productID/version max 50 |
| Date-time | n/a request; response `activationDate` ISO date-time |
| Success | Guide sample `statusCode: 1`, remark pending confirmation; returns `jwtToken`, `secretKey`, configs |
| HTTP errors | 200, 500 (OpenAPI) |
| Retry safety | **Unsafe** — TAC single-use risk |
| Discrepancy | MAC mandatory conflict; productID format from MRA certification |
| Swagger / Docs | OpenAPI + `terminal_activation.htm` / `request_1.htm` |

### A2. Confirm Terminal Activation

| Attribute | Value |
|---|---|
| Official name | Terminal activated confirmation |
| Group | OnBoarding |
| Method / Path | `POST /api/v1/onboarding/terminal-activated-confirmation` |
| Auth | Guide sample puts JWT-looking value in `x-signature` header — **Conflict** with prose |
| Required headers | `x-signature`* |
| Message-hash | No |
| Signature | **Yes** — HMAC-SHA512(UTF8(TAC), UTF8(secretKey)) → standard Base64 |
| Known-answer | plain=`MRA`, key=`123456` → `xludP1OafF422HgSRaKqZiUXaFALv8D+mnBJOWd5vDK7N7T22V+WOTvgIFQ7I1p+S2cIPg3JxuVm4xth+8UQ/Q==` |
| Request schema | `ActivatedTerminalConfirmation` |
| Response schema | `BooleanAPIResponse` (`data: true`) |
| Required fields | `terminalId` (minLength 1; Guide max 50) |
| Success | Guide `statusCode: 1`, remark fully activated |
| HTTP errors | 200, 401, 500 |
| Retry safety | Likely unsafe / once; **Pending** |
| Discrepancy | Curl sample `x-signature` appears to be JWT; prose + known-answer = HMAC — **trust prose + known-answer** |
| Swagger / Docs | OpenAPI + `terminal_activated_confirmation.htm` / `hmac_online_tool.htm` |

---

## B. Configuration

### B1. Get Latest Configs

| Attribute | Value |
|---|---|
| Method / Path | `POST /api/v1/configuration/get-latest-configs` |
| Auth | JWT (Guide-only) |
| Body | None in OpenAPI |
| Response | `ConfigurationAPIResponse` → `Configuration` |
| Success | Returns global / terminal / taxpayer configs + version numbers |
| HTTP | 200, 500 |
| Discrepancy | Guide sample uses **GET**; Swagger **POST** — implement POST |
| Docs | `get_latest_configuration.htm` |

### B2. Request New Terminal Token

| Attribute | Value |
|---|---|
| Method / Path | `POST /api/v1/configuration/request-new-terminal-token` |
| Auth | JWT (Guide-only) |
| Body | None in OpenAPI |
| Response | `ObjectAPIResponse` (token payload shape **Pending** sandbox) |
| HTTP | 200, 401, 500 |
| Retry | **Pending** |

---

## C. Sales

### C1. Submit Sales Transaction

| Attribute | Value |
|---|---|
| Method / Path | `POST /api/v1/sales/submit-sales-transaction` |
| Auth | JWT (Guide-only) |
| Message-hash / Signature headers | **Unverified** / No OpenAPI `x-signature` |
| Body schema | `SalesInvoice` |
| Required | `invoiceHeader`, `invoiceLineItems`, `invoiceSummary` |
| Header required fields | `invoiceNumber`, `invoiceDateTime` (date-time), `sellerTIN`, `siteId`, `globalConfigVersion`, `taxpayerConfigVersion`, `terminalConfigVersion` |
| Header optional | `buyerTIN`, `buyerName`, `buyerAuthorizationCode`, `isExport`, `isReliefSupply`, `vat5CertificateDetails`, `paymentMethod` |
| Summary required | `taxBreakDown[]` (`rateId`, `taxableAmount`, `taxAmount`) |
| Summary optional | `levyBreakDown`, `totalVAT`, `offlineSignature`, `invoiceTotal`, `amountTendered` |
| Line fields | `id`, `productCode`, `description`, `unitPrice`, `quantity`, `discount`, `total`, `totalVAT`, `taxRateId`, `isProduct` (no OpenAPI `required` array on LineItemDto — Guide may mandate several) |
| Decimal rules | OpenAPI `number`/`double` — scale rules **Pending** |
| Date-time | `invoiceDateTime` format `date-time` |
| Invoice number | Guide: Base64(TaxpayerID)-Base64(TerminalPosition)-Base64(JulianDate)-Base64(Count) — **not** plain `TIN-pos-YYYYMMDD-seq` |
| Response | `InvoiceResponseAPIResponse` → `validationURL`, `shouldDownloadLatestConfig`, `shouldBlockTerminal`, `validationErrors` |
| Success sample | Guide sales `statusCode: 0` (**Conflict** with activation `1`) |
| HTTP | 200, 400, 401, 403, 500 |
| Offline | Set `invoiceSummary.offlineSignature` when offline path used |
| Retry | **Unsafe** without proven idempotency on invoiceNumber |
| Docs | `sale_transaction.htm`, `invoice_number_generation.htm` |

### C2. Last Submitted Online Transaction

| Attribute | Value |
|---|---|
| Method / Path | `POST /api/v1/sales/last-submitted-online-transaction` |
| Auth | JWT | Body | none |
| Response | `LastSubmittedInvoiceAPIResponse` |
| HTTP | 200, 401, 500 |
| Retry | Safe (read) |

### C3. Last Submitted Offline Transaction

| Attribute | Value |
|---|---|
| Method / Path | `POST /api/v1/sales/last-submitted-offline-transaction` |
| Auth | JWT | Body | none |
| Response | `LastSubmittedInvoiceAPIResponse` |
| HTTP | 200, 401, 500 |
| Retry | Safe (read) |

### C4. Get Invoice By Number

| Attribute | Value |
|---|---|
| Method / Path | `POST /api/v1/sales/get-invoice-by-number` |
| Body | `InvoiceLookupRequest` |
| Response | `InvoiceLookupResponseAPIResponse` (validation URL + levy details) |
| HTTP | 200, 400, 401, 404 |
| Retry | Safe (read) |

### C5. Process Credit / Debit Note

| Attribute | Value |
|---|---|
| Method / Path | `POST /api/v1/sales/process-credit-debit-note` |
| Body | `InvoiceAdjustmentRequest` |
| Response | `InvoiceAdjustmentResponseAPIResponse` |
| Business rule (OpenAPI summary) | Higher VAT/total → debit note; lower → credit note |
| HTTP | 200, 400, 401, 404, 500 |
| Retry | Unsafe until proven |

### C6. Cancel Receipt (Void)

| Attribute | Value |
|---|---|
| Method / Path | `POST /api/v1/sales/cancel-receipt` |
| Tag | Utilities (path under `/sales/`) |
| Body | `VoidReceiptCreateDto` |
| Response | `VoidReceiptResponseDtoAPIResponse` |
| HTTP | 200, 400, 401, 404, 500 |

### C7. Get Void Receipts

| Attribute | Value |
|---|---|
| Method / Path | `POST /api/v1/sales/get-void-receipts` |
| Body | `VoidReceiptFilterDto` |
| Response | Paginated `GetVoidReceiptResponseDto…` |
| HTTP | 200, 400, 401, 500 |

---

## D. Utilities

| ID | Method / Path | Body | Response | Notes |
|---|---|---|---|---|
| D1 | `POST /api/v1/utilities/ping` | none | `PongResponseAPIResponse` | Connectivity; HTTP 200/400/503 |
| D2 | `POST /api/v1/utilities/product-status` | `ProductIdentifier` | `ProductStateAPIResponse` | UNSPSC mapping status |
| D3 | `POST /api/v1/utilities/get-terminal-site-products` | (schema in JSON) | products list | Site catalogue |
| D4 | `POST /api/v1/utilities/taxpayer-initial-inventory-upload` | `TaxpayerInitialInventoryUploadRequest` | `InitialInventoryResponseAPIResponse` | ≤50 products/batch; last-batch flag |
| D5 | `POST /api/v1/utilities/validate-vat5-certificate` | `Vat5CertificateValidationRequest` | VAT5 validation response | |
| D6 | `POST /api/v1/utilities/validate-authorization-code` | `UnValidatedAuthorizationCode` | `ValidatedAuthorizationCodeAPIResponse` | |
| D7 | `POST /api/v1/utilities/check-tin-authorization-requirement` | `TinAuthorizationRequirementRequest` | requirement response | |
| D8 | `POST /api/v1/utilities/get-terminal-blocking-message` | `TerminalBlockRequest` | `TerminalBlockResponseAPIResponse` | |
| D9 | `POST /api/v1/utilities/check-terminal-unblock-status` | `TerminalBlockRequest` | unblock status response | |

Auth for D*: JWT (Guide-only) except ping may work without — **Pending**.

---

## E. Stock & Raw Material

| ID | Method / Path | Notes |
|---|---|---|
| E1 | `GET /api/v1/stock/warehouse-inventory` | Query `page`, `pageSize` (default 50, max 200) |
| E2 | `POST /api/v1/stock/transfer-inventory` | Warehouse→Site or Site→Site; one type per request |
| E3 | `POST /api/v1/stock/submit-informal-purchase` | Approval workflow; HTTP includes 202 |
| E4 | `POST /api/v1/stock/submit-adjustment` | Increase/Decrease by barcode |
| E5 | `POST /api/v1/stock/getStockAdjustmentReasons` | Reasons list |
| E6 | `POST /api/v1/stock/get-suppliers` | Suppliers list |
| E7 | `GET /api/v1/raw-material/get-raw-material` | Paged raw materials |
| E8 | `POST /api/v1/raw-material/submit-conversion` | Production/conversion |

Auth: JWT. Schemas in OpenAPI (`InventoryTransferRequest`, `StockAdjustmentRequestDto`, etc.).

---

## F. Sandbox-only (+3)

| ID | Method / Path | Purpose |
|---|---|---|
| F1 | `POST /api/v1/stock/add-product` | Add product + zero warehouse qty |
| F2 | `GET /api/v1/stock/get-hs-codes` | HS codes |
| F3 | `GET /api/v1/stock/get-units-of-measure` | UoM list |

Do **not** call F* against production unless production OpenAPI gains them.

---

## G. Crypto contracts (summary)

| Use case | Algorithm | Input | Key | Encoding | Header / field |
|---|---|---|---|---|---|
| Activation confirmation | HMAC-SHA512 | TAC string | `secretKey` | Standard Base64 | `x-signature` |
| Offline receipt | HMAC-SHA256 | Query-param string of invoice fields (guide) | `secretKey` | URL-safe Base64 | `invoiceSummary.offlineSignature` (+ validation URL) |
| General “payload signature” prose | HMAC-SHA512 (guide §3.4) | Ambiguous “payload” | `secretKey` | Base64 | **Unverified** as HTTP header for sales — may only describe confirmation / offline |

---

## H. Matrix completion status

| Area | OpenAPI path/schema | Guide behaviour | Sandbox verified | Contract tests |
|---|---|---|---|---|
| Onboarding | Done | Done (with conflicts noted) | Pending | Pending |
| Configuration | Done | Partial | Pending | Pending |
| Sales core | Done | Partial | Pending | Pending |
| Credit/void | Schema names only | Thin | Pending | Pending |
| Utilities | Done list | Partial | Pending | Pending |
| Stock | Done list | Thin in crawl | Pending | Pending |
| Message-hash | Absent | Absent | Pending | N/A until proven |

When a phase starts, update the relevant row’s **Sandbox result** and **Contract-test status** columns in a phase evidence note (do not invent results).
