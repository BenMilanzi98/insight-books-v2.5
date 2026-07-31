# 02 — Swagger / OpenAPI API Reference

**Source of truth for this file:** `swagger-production.v1.json` (and sandbox delta).  
**Captured:** 2026-07-22.

All paths below are relative to environment base URL:

- Sandbox: `https://dev-eis-api.mra.mw`
- Production: `https://eis-api.mra.mw`

Unless noted, request body content types include `application/json`.

---

## 1. Response envelope (common)

Most responses use:

```json
{
  "statusCode": 0,
  "remark": "string",
  "data": { },
  "errors": [
    { "errorCode": 0, "fieldName": "string", "errorMessage": "string" }
  ]
}
```

Schema: `*APIResponse` wrappers + `APIError`.

**Important:** Guide samples use `statusCode: 0` (sales) and `statusCode: 1` (activation success). Treat success codes as **environment-verified**, not assumed. See discrepancies doc.

HTTP codes declared in OpenAPI commonly include: `200`, `400`, `401`, `403`, `404`, `500` (varies by operation).

---

## 2. Security (as declared in OpenAPI)

OpenAPI **does not declare** `securitySchemes` or global `security`.

From operation parameters + developer guide:

| Mechanism | Where declared | Notes |
|---|---|---|
| JWT in `Authorization` header | Guide curl samples | Raw JWT string in samples (often **without** `Bearer ` prefix). Activation returns `terminalCredentials.jwtToken`. |
| `x-signature` header | Swagger **required** on `terminal-activated-confirmation` | HMAC-SHA512(TAC, secretKey) → Base64 (guide + known-answer). |
| `secretKey` | Activation response body | Used for signing / offline HMAC; never log. |
| `x-eis-message-hash` | **Not in OpenAPI** | Mentioned in InsightBooks master prompt; **unconfirmed** against live Swagger — see open questions. |

---

## 3. Endpoint catalogue — Production (28)

### 3.1 OnBoarding

| Method | Path | Summary | Body schema | Notable headers |
|---|---|---|---|---|
| POST | `/api/v1/onboarding/activate-terminal` | Activates a terminal | `UnActivatedTerminal` | — |
| POST | `/api/v1/onboarding/terminal-activated-confirmation` | Confirm activation processed | `ActivatedTerminalConfirmation` | **`x-signature` required** |

**`UnActivatedTerminal` (required):**

- `terminalActivationCode` (string)
- `environment.platform`: `osName`, `osVersion` required; `osBuild`, `macAddress` optional in schema (guide marks MAC mandatory — see discrepancies)
- `environment.pos`: `productID`, `productVersion` required

**`ActivatedTerminalConfirmation` (required):**

- `terminalId` (string, minLength 1)

**Activation success payload (`TerminalActivationResponse`):**

- `activatedTerminal.terminalId`, `terminalPosition`, `taxpayerId`, `activationDate`
- `activatedTerminal.terminalCredentials.jwtToken`, `secretKey`
- `configuration` → global / terminal / taxpayer configs

---

### 3.2 Configuration

| Method | Path | Summary | Body | Auth (guide) |
|---|---|---|---|---|
| POST | `/api/v1/configuration/get-latest-configs` | Latest device configurations | none in OpenAPI | JWT |
| POST | `/api/v1/configuration/request-new-terminal-token` | New terminal token | none in OpenAPI | JWT (renewal) |

**`Configuration`:**

- `globalConfiguration` (`TaxConfiguration`: `id`, `versionNo`, `taxrates[]`)
- `terminalConfiguration` (`TerminalConfiguration`: label, contacts, `terminalSite`, `offlineLimit`, …)
- `taxpayerConfiguration` (`TaxpayerConfiguration`: `tin`, VAT flags, tax office, activated rates/levies)

**`OfflineLimit`:**

- `maxTransactionAgeInHours`
- `maxCummulativeAmount` *(spelling as in OpenAPI)*

**Guide discrepancy:** sample curl for get-latest-configs uses **GET**; Swagger method is **POST**.

---

### 3.3 Sales

| Method | Path | Summary | Body schema |
|---|---|---|---|
| POST | `/api/v1/sales/submit-sales-transaction` | Submit sales transaction | `SalesInvoice` |
| POST | `/api/v1/sales/last-submitted-online-transaction` | Last online transaction | none |
| POST | `/api/v1/sales/last-submitted-offline-transaction` | Last offline transaction | none |
| POST | `/api/v1/sales/get-invoice-by-number` | Fetch invoice + validation URL / levies | `InvoiceLookupRequest` |
| POST | `/api/v1/sales/process-credit-debit-note` | Credit/debit note from existing invoice | `InvoiceAdjustmentRequest` |
| POST | `/api/v1/sales/cancel-receipt` | Void request (tagged Utilities in swagger) | `VoidReceiptCreateDto` |
| POST | `/api/v1/sales/get-void-receipts` | List void requests (paginated filter) | `VoidReceiptFilterDto` |

#### `SalesInvoice` (required parts)

```
SalesInvoice
├── invoiceHeader (InvoiceHeader)          [required]
├── invoiceLineItems[] (LineItemDto)       [required]
└── invoiceSummary (InvoiceSummary)        [required]
```

**`InvoiceHeader` required fields (OpenAPI):**

- `invoiceNumber`, `invoiceDateTime`, `sellerTIN`, `siteId`
- `globalConfigVersion`, `taxpayerConfigVersion`, `terminalConfigVersion`

Optional / flags: `buyerTIN`, `buyerName`, `buyerAuthorizationCode`, `isExport`, `isReliefSupply`, `vat5CertificateDetails`, `paymentMethod`

**`LineItemDto` fields:** `id`, `productCode`, `description`, `unitPrice`, `quantity`, `discount`, `total`, `totalVAT`, `taxRateId`, `isProduct`

**`InvoiceSummary`:**

- required: `taxBreakDown[]` (`rateId`, `taxableAmount`, `taxAmount`)
- optional: `levyBreakDown[]`, `totalVAT`, `offlineSignature`, `invoiceTotal`, `amountTendered`

**`InvoiceResponse` (submit data):**

- `validationURL`
- `shouldDownloadLatestConfig` (boolean)
- `shouldBlockTerminal` (boolean)
- `validationErrors[]`

Guide field comments mark several OpenAPI-optional fields as mandatory for successful submit (e.g. `paymentMethod`, line `productCode`) — see matrix / discrepancies.

---

### 3.4 Utilities

| Method | Path | Summary | Body |
|---|---|---|---|
| POST | `/api/v1/utilities/ping` | Connectivity | none |
| POST | `/api/v1/utilities/product-status` | UNSPSC mapping status | `ProductIdentifier` (`productId`, `tin`) |
| POST | `/api/v1/utilities/get-terminal-site-products` | Site products/services | (see schema in JSON) |
| POST | `/api/v1/utilities/taxpayer-initial-inventory-upload` | Phased initial inventory (≤50/batch) | `TaxpayerInitialInventoryUploadRequest` |
| POST | `/api/v1/utilities/validate-vat5-certificate` | VAT5 certificate validation | `Vat5CertificateValidationRequest` |
| POST | `/api/v1/utilities/validate-authorization-code` | Buyer auth code validity | `UnValidatedAuthorizationCode` |
| POST | `/api/v1/utilities/check-tin-authorization-requirement` | Whether TIN needs auth code | `TinAuthorizationRequirementRequest` |
| POST | `/api/v1/utilities/get-terminal-blocking-message` | Blocking reason | `TerminalBlockRequest` |
| POST | `/api/v1/utilities/check-terminal-unblock-status` | Unblock check | `TerminalBlockRequest` |

---

### 3.5 Stock / Raw material

| Method | Path | Summary |
|---|---|---|
| GET | `/api/v1/stock/warehouse-inventory` | Warehouse inventory (`page`, `pageSize` query; default 50, max 200) |
| POST | `/api/v1/stock/transfer-inventory` | Warehouse→Site or Site→Site |
| POST | `/api/v1/stock/submit-informal-purchase` | Informal purchase (approval) |
| POST | `/api/v1/stock/submit-adjustment` | Stock adjustment |
| POST | `/api/v1/stock/getStockAdjustmentReasons` | Adjustment reasons |
| POST | `/api/v1/stock/get-suppliers` | Suppliers |
| GET | `/api/v1/raw-material/get-raw-material` | Raw materials inventory (paged) |
| POST | `/api/v1/raw-material/submit-conversion` | Production/conversion |

---

## 4. Sandbox-only endpoints (+3)

| Method | Path | Summary |
|---|---|---|
| POST | `/api/v1/stock/add-product` | Add product + zero warehouse qty |
| GET | `/api/v1/stock/get-hs-codes` | HS code lookup |
| GET | `/api/v1/stock/get-units-of-measure` | UoM list |

Schemas unique/extra in sandbox include `AddProductApiRequest`, `HsCodeLookupDto`, `UnitOfMeasureDto`, etc.

---

## 5. Schema index (production = 94)

Full list in `_swagger-summary.txt`. Core schemas for sales/onboarding are also in `core-schemas.extracted.json`.

Key names: `SalesInvoice`, `InvoiceHeader`, `InvoiceSummary`, `LineItemDto`, `InvoiceResponse`, `UnActivatedTerminal`, `TerminalCredentials`, `Configuration`, `TaxRateDto`, `OfflineLimit`, `LastSubmittedInvoice`, `Vat5CertificateDto`, `APIError`, `PongResponse`, …

---

## 6. How to regenerate this catalogue

```bash
# from repo root
Invoke-WebRequest https://eis-api.mra.mw/swagger/v1/swagger.json -OutFile docs/mra-eis/swagger-production.v1.json
Invoke-WebRequest https://dev-eis-api.mra.mw/swagger/v1/swagger.json -OutFile docs/mra-eis/swagger-sandbox.v1.json
node docs/mra-eis/_parse-swagger.js
```
