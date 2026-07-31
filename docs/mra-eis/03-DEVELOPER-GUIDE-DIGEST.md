# 03 — Developer Guide Digest

**Source:** https://eis-api.mra.mw/docs/ (HTML crawl under `guide/`)  
**Captured:** 2026-07-22  
**Purpose:** Extract operational rules that OpenAPI alone does not fully express.

---

## 1. Integration overview (MRA narrative)

MRA EIS is a fiscalization / electronic invoicing integration for POS and accounting systems. Typical flow:

1. Register / certify product with MRA; obtain `productID` + `productVersion`.
2. Activate terminal with TAC (Terminal Activation Code).
3. Confirm activation with HMAC signature.
4. Pull/apply configuration (tax rates, terminal, taxpayer).
5. Map inventory/products (UNSPSC / product codes as required).
6. Submit sales invoices online; support offline signing when connectivity fails.
7. Present QR / validation URL to buyer.
8. Handle credits/debits, voids, stock ops, config refresh, token renewal.

InsightBooks mapping (product intent, not MRA API): **sale finalize → V2 posting → EIS eligibility → fiscal payload → transmit/sign → QR → reconcile**. Accounting journals remain InsightBooks authority.

---

## 2. Environments

| Env | API base (guide + practice) | Portal notes |
|---|---|---|
| Sandbox / pre-integration | `https://dev-eis-api.mra.mw` | `https://dev-eis-portal.mra.mw/` |
| Production | `https://eis-api.mra.mw` | Production portal / e-services for validation |

Guide samples sometimes show duplicated path segments (`/api/v1/api/v1/...`) — **treat as documentation bugs**; canonical paths are those in Swagger.

---

## 3. Authentication & credentials

### 3.1 Activation

`POST /api/v1/onboarding/activate-terminal` with TAC + environment fingerprint.

On success, response includes:

- `terminalId`, `terminalPosition`, `taxpayerId`
- `terminalCredentials.jwtToken`
- `terminalCredentials.secretKey`
- Nested `configuration` snapshot

**Store securely:** JWT + secretKey are long-lived secrets for the terminal. Never commit or log plaintext.

### 3.2 Subsequent calls

Guide curl samples pass:

```http
Authorization: <jwtToken>
```

Often **without** the `Bearer ` prefix. Implementation must verify which form sandbox accepts (both may work; do not invent — test).

### 3.3 Token renewal

`POST /api/v1/configuration/request-new-terminal-token` — renew when token expiry / policy requires.

### 3.4 Activation confirmation signature

`POST /api/v1/onboarding/terminal-activated-confirmation`

- Header: `x-signature` (**required** in OpenAPI)
- Algorithm (guide): **HMAC-SHA512**
  - Message (plaintext): TAC (`terminalActivationCode`)
  - Key: `secretKey` from activation response
  - Encoding: **standard Base64** of the HMAC digest

**Known-answer test (from MRA guide):**

| Input | Value |
|---|---|
| plain | `MRA` |
| key | `123456` |
| expected Base64 | `xludP1OafF422HgSRaKqZiUXaFALv8D+mnBJOWd5vDK7N7T22V+WOTvgIFQ7I1p+S2cIPg3JxuVm4xth+8UQ/Q==` |

Body: `{ "terminalId": "<id>" }`.

---

## 4. Invoice number generation

Guide algorithm (digest):

1. Components: TaxpayerID, TerminalPosition, JulianDate, sequential Count.
2. Convert each component from Base10 → Base64 (per guide encoding rules).
3. Join with `-`.
4. Result is `invoiceHeader.invoiceNumber`.

Exact Base64 encoding of integers and Julian date calculation must be implemented from the guide page samples and verified in sandbox. Do not invent alternate invoice numbering for fiscal submit.

---

## 5. Online sales submit

`POST /api/v1/sales/submit-sales-transaction` with `SalesInvoice`.

Success path (guide sample):

- Returns `data.validationURL` (QR / buyer validation)
- May set `shouldDownloadLatestConfig` / `shouldBlockTerminal`
- May return `validationErrors[]`

Guide narrative: include current config version fields on header; refresh configs when flagged.

**statusCode sample conflict:** sales sample uses `0`; activation samples use `1` for success — verify per endpoint in sandbox.

---

## 6. Offline signing

When online submit is unavailable within MRA offline limits:

1. Build the same fiscal invoice structure.
2. Compute **offline signature** using **HMAC-SHA256** over a **query-parameter-style string** of invoice fields (exact field order/format from guide offline page).
3. Encode digest as **URL-safe Base64**.
4. Store in `invoiceSummary.offlineSignature`.
5. Later sync / submit when online; validation portal URL pattern referenced as ReceiptValidation (sandbox portal).

Offline limits come from `terminalConfiguration.offlineLimit`:

- `maxTransactionAgeInHours`
- `maxCummulativeAmount` (OpenAPI spelling)

Exceeding limits requires online connectivity / blocking behaviour per MRA rules.

---

## 7. Configuration lifecycle

- After activation: use embedded configuration OR call `get-latest-configs`.
- After sales: honour `shouldDownloadLatestConfig`.
- Tax rates: `globalConfiguration.taxrates` with rate IDs used in line items / tax breakdown.
- Taxpayer flags: VAT registration, export/relief, activated levies.

**Method mismatch:** guide sample for latest configs uses GET; Swagger = POST with empty body.

---

## 8. Credit / debit notes & voids

- `process-credit-debit-note` — adjustment against existing fiscal invoice (`InvoiceAdjustmentRequest`).
- `cancel-receipt` / `get-void-receipts` — void workflow with filter DTO.

Business rules for when credit vs void applies are MRA policy + guide; must be mapped carefully to InsightBooks refund/credit flows in a later phase.

---

## 9. Stock & inventory (fiscal)

EIS stock endpoints are **MRA fiscal stock**, not a replacement for InsightBooks inventory:

- Warehouse inventory, transfers, informal purchase, adjustments, raw material conversion.
- Sandbox helpers: add-product, HS codes, UoM.

Product mapping utilities (`product-status`, site products) support UNSPSC / product readiness.

---

## 10. VAT5 & buyer authorization

Utilities support:

- Validate VAT5 certificate
- Validate authorization code
- Check whether a TIN requires authorization

Invoice header may carry `vat5CertificateDetails`, `buyerAuthorizationCode`, relief/export flags when applicable.

---

## 11. Terminal blocking

- Sales response may set `shouldBlockTerminal`.
- Utilities: `get-terminal-blocking-message`, `check-terminal-unblock-status`.

InsightBooks must surface block state and stop fiscal transmit until unblocked.

---

## 12. Error model

Envelope `errors[]` with `errorCode`, `fieldName`, `errorMessage`.  
HTTP 400/401/403/404/500 also declared. Map to InsightBooks EIS job failure reasons without inventing codes.

---

## 13. Guide quality issues to ignore when coding

| Issue | Action |
|---|---|
| `/api/v1/api/v1/` duplicated in sample URLs | Use Swagger path once |
| GET vs POST for get-latest-configs | Prefer Swagger **POST** |
| Mixed statusCode success values | Verify in sandbox |
| MAC address “mandatory” in prose vs optional in schema | Confirm with MRA / sandbox behaviour |

Local extract helpers: `_guide-extracts.txt`, `_hmac-extracts.txt`.
