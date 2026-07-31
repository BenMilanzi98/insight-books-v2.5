/** Phase 1 contracts, registers, final report */
const path = require('path');
const fs = require('fs');
const { doc, written, conf, ACCESS } = require('./_gen-phase1-pack-part2.js');

doc('GENERAL_REQUEST_CONTRACT.md', 'General Request Contract', [
  '## Verified headers',
  '',
  '| Header | Evidence | Required when | Confidence |',
  '|---|---|---|---|',
  '| Content-Type: application/json | OpenAPI + guide curls | Bodies present | VO |',
  '| Accept | Guide samples text/plain | Optional in samples | OA |',
  '| Authorization | Guide curls (raw JWT) | Post-activation | OI (Bearer vs raw) |',
  '| x-signature | OpenAPI required param | Activation confirmation only | VO |',
  '| x-eis-message-hash | **Not in OpenAPI/guide crawl** | — | Unverified / RC |',
  '| x-access-key | Not in OpenAPI | — | Unverified / RC |',
  '',
  '## Serialization',
  '',
  '| Topic | Finding | Confidence |',
  '|---|---|---|',
  '| JSON property casing | camelCase in schemas | VO |',
  '| additionalProperties | false on core sales schemas | VO |',
  '| Date-time | format date-time on invoiceDateTime | VO |',
  '| Decimals | number/double — scale undocumented | RC |',
  '| Hash canonicalization | Not defined for general requests | RC |',
  '| Empty body hashing | N/A until message-hash proven | RC |',
  '',
  '**Do not implement production signing while message-hash input unresolved.**',
]);

doc('GENERAL_RESPONSE_CONTRACT.md', 'General Response Contract', [
  '## Envelope (OpenAPI)',
  '',
  '`statusCode` (int32), `remark` (string|null), `data` (varies), `errors` (APIError[]|null)',
  '',
  'APIError: `errorCode`, `fieldName`, `errorMessage`',
  '',
  '## Success rules',
  '',
  '| Observation | Confidence |',
  '|---|---|',
  '| Activation samples use statusCode **1** | Official sample |',
  '| Sales sample uses statusCode **0** | Official sample |',
  '| HTTP 200 may still carry business failure via errors/remark | INF — must verify |',
  '| Do not define success as HTTP 200 alone | Engineering rule from Phase 1 prompt + ambiguity |',
  '',
  'Sales-specific flags in data: validationURL, shouldDownloadLatestConfig, shouldBlockTerminal, validationErrors.',
]);

doc('ERROR_CODE_CATALOGUE.md', 'Error Code Catalogue', [
  '## Status',
  '',
  'Guide page `error_codes.htm` exists. Full numeric catalogue not machine-extracted into structured table in this pass.',
  '',
  '## Envelope fields',
  '',
  '| Field | Source |',
  '|---|---|',
  '| errors[].errorCode | OpenAPI APIError |',
  '| errors[].fieldName | OpenAPI |',
  '| errors[].errorMessage | OpenAPI |',
  '',
  '## Classification framework (for later mapping)',
  '',
  'VALIDATION · AUTHENTICATION · AUTHORIZATION · TERMINAL · CONFIGURATION · PRODUCT · INVENTORY · TAX · VAT5 · BUYER · SALES · OFFLINE · BLOCKING · RATE_LIMIT · TEMPORARY_SERVICE · UNKNOWN',
  '',
  '## Retryability',
  '',
  '**Not invented.** All retry flags = UNKNOWN until sandbox evidence. See TIMEOUT research.',
  '',
  '## Action',
  '',
  'Populate rows during authorized sandbox testing; attach evidence excerpts only.',
]);

doc('TERMINAL_ACTIVATION_CONTRACT.md', 'Terminal Activation Contract', [
  '## Endpoint',
  '',
  '`POST /api/v1/onboarding/activate-terminal` — schema `UnActivatedTerminal`',
  '',
  '## Fields',
  '',
  '| Field | OpenAPI | Guide |',
  '|---|---|---|',
  '| terminalActivationCode | required string minLength 1 | Mandatory max 50 |',
  '| platform.osName/osVersion | required | Mandatory max 50 |',
  '| platform.osBuild | optional | Optional max 50 |',
  '| platform.macAddress | optional nullable | **Mandatory** 17 chars |',
  '| pos.productID/productVersion | required | Mandatory max 50; certified IDs |',
  '',
  '## Response credentials',
  '',
  'terminalId, terminalPosition, taxpayerId, activationDate, jwtToken, secretKey, nested Configuration. Sample statusCode=1, remark pending confirmation.',
  '',
  '## Retry / timeout recovery',
  '',
  '**UNKNOWN / RC:** If MRA activates but client loses response — no documented recovery endpoint. Clarification Q-016 mandatory.',
  '',
  '## Phase 1 boundary',
  '',
  'Do not enter real TAC into unverified client. No activation performed.',
]);

doc('TERMINAL_ACTIVATION_CONFIRMATION_CONTRACT.md', 'Terminal Activation Confirmation Contract', [
  '## Endpoint',
  '',
  '`POST /api/v1/onboarding/terminal-activated-confirmation`',
  '',
  '## Signature (written algorithm + known-answer)',
  '',
  '| Item | Value | Confidence |',
  '|---|---|---|',
  '| Header | x-signature (required) | VO |',
  '| Algorithm | HMAC-SHA512 | VO |',
  '| Plaintext | Terminal Activation Code (UTF-8) | VO |',
  '| Key | secretKey (UTF-8) | VO |',
  '| Encoding | Standard Base64 | VO |',
  '| KAT | plain=MRA key=123456 → xludP1OafF422HgSRaKqZiUXaFALv8D+mnBJOWd5vDK7N7T22V+WOTvgIFQ7I1p+S2cIPg3JxuVm4xth+8UQ/Q== | VO |',
  '',
  'Body: `{ terminalId }`',
  '',
  '## Discrepancy',
  '',
  'Guide curl sample appears to put JWT-like value in x-signature — **CONFLICT** with prose+KAT. Prefer prose+KAT.',
  '',
  '## Verification gate',
  '',
  'Sandbox verification still required before production client. KAT can be unit-tested offline without MRA.',
]);

doc('AUTHENTICATION_AND_CREDENTIAL_RESEARCH.md', 'Authentication and Credential Research', [
  '## Credentials',
  '',
  '| Field | Class | Lifecycle notes |',
  '|---|---|---|',
  '| TAC | SHORT_LIVED_SECRET | Single-use activation; never reuse |',
  '| jwtToken | SHORT_LIVED_SECRET (claims include exp) | Renew via request-new-terminal-token |',
  '| secretKey | LONG_LIVED_SECRET | Signing/offline; rotation RC |',
  '| terminalId | INTERNAL | Public-ish identifier |',
  '| productID/version | INTERNAL | Certification identity |',
  '| TIN | CONFIDENTIAL | Taxpayer identity |',
  '',
  '## JWT',
  '',
  'Guide samples show issuer MRA, audience EISTerminals, claims DeviceId, SecretKey, APIKey, TIN, exp. **Do not log claims containing secrets.**',
  '',
  '## Preliminary security requirements (later phases)',
  '',
  'Encrypt at rest · no frontend exposure · no logs/exports · RBAC · audit access · rotation/revocation capability.',
  '',
  '**Phase 1:** no real credentials stored.',
]);

doc('CRYPTOGRAPHIC_REQUIREMENTS.md', 'Cryptographic Requirements', [
  '## Operations',
  '',
  '### 1. Activation confirmation signature',
  '',
  '| Attribute | Value | Status |',
  '|---|---|---|',
  '| Purpose | Confirm activation | Verified algorithm |',
  '| Algorithm | HMAC-SHA512 | Known |',
  '| Input | TAC string | Known |',
  '| Key | secretKey | Known |',
  '| Output | Standard Base64 | Known |',
  '| Official KAT | Yes (MRA/123456) | Pass requirement for offline unit test |',
  '| Sandbox validation | Pending | Not VERIFIED_BY_SANDBOX |',
  '',
  '### 2. General message hash (x-eis-message-hash)',
  '',
  '| Attribute | Value | Status |',
  '|---|---|---|',
  '| Presence in OpenAPI | Absent | BLOCKING ambiguity |',
  '| Presence in guide crawl | Not found as header name | BLOCKING |',
  '| Master prompt claim | Required except activation | Unverified |',
  '| Implementation | **FORBIDDEN until proven** | — |',
  '',
  '### 3. Offline signature',
  '',
  '| Attribute | Value | Status |',
  '|---|---|---|',
  '| Algorithm | HMAC-SHA256 | Guide |',
  '| Input | Query-parameter string (invoice fields) | Partial — order/format RC |',
  '| Output | URL-safe Base64 | Guide |',
  '| Field | invoiceSummary.offlineSignature | OpenAPI |',
  '| Official reproducible example | Incomplete in this pack | BLOCK offline impl until KAT |',
  '',
  '### 4. Fiscal number Base64 components',
  '',
  'See FISCAL_NUMBERING_CONTRACT.md — algorithm documented; independent reproduction pending exact integer→Base64 rules.',
  '',
  '## Gate',
  '',
  'A crypto contract is VERIFIED only when algorithm+input+serialization+encoding+expected output+test vector pass.',
]);

doc('CONFIGURATION_CONTRACT.md', 'Configuration Contract', [
  '## Retrieval',
  '',
  '`POST /api/v1/configuration/get-latest-configs` (OpenAPI). Guide sample incorrectly shows GET.',
  '',
  'Also embedded in activation response.',
  '',
  '## Global',
  '',
  'id, versionNo, taxrates[] (id, name, chargeMode, ordinal, rate)',
  '',
  '## Terminal',
  '',
  'versionNo, terminalLabel, contacts, tradingName, addressLines, offlineLimit{maxTransactionAgeInHours,maxCummulativeAmount}, terminalSite…',
  '',
  '## Taxpayer',
  '',
  'versionNo, tin, isVATRegistered, taxOffice, activatedTaxRateIds / activatedTaxrates, activated levies',
  '',
  '## Refresh triggers',
  '',
  'Startup/BOD (engineering): recommended. Sales response `shouldDownloadLatestConfig`. Stale version rejection: RC.',
  '',
  'Do not hardcode sample rates as permanent rules.',
]);

doc('TAX_AND_LEVY_CONTRACT.md', 'Tax and Levy Contract', [
  '## API representation',
  '',
  '- Tax rates from globalConfiguration.taxrates; line taxRateId; summary taxBreakDown{rateId,taxableAmount,taxAmount}',
  '- Levies: levyBreakDown; activated levies on taxpayer config',
  '- chargeMode examples in samples: Item, Global',
  '',
  '## Separations',
  '',
  '| Layer | Role |',
  '|---|---|',
  '| MRA API | Authoritative rates/versions for fiscal payload |',
  '| InsightBooks tax | Local catalog — must map, not invent MRA IDs |',
  '| Legal treatment | Counsel/tax advisor |',
  '',
  'Rounding/scale: RC. Sample rates (e.g. 16.5) are examples only.',
]);

doc('PRODUCT_STATUS_CONTRACT.md', 'Product Status Contract', [
  '`POST /api/v1/utilities/product-status` body ProductIdentifier{productId, tin}',
  '',
  'Purpose (OpenAPI): UNSPSC mapping status at MRA.',
  '',
  '| Question | Answer |',
  '|---|---|',
  '| Read-only? | Yes (status check) |',
  '| Required before every sale? | Not stated — do not assume | INF/RC |',
  '| Cacheable? | Unknown | RC |',
  '| Authoritative stock? | No — use inventory endpoints/portal | INF |',
]);

doc('INITIAL_INVENTORY_UPLOAD_CONTRACT.md', 'Initial Inventory Upload Contract', [
  '`POST /api/v1/utilities/taxpayer-initial-inventory-upload`',
  '',
  'OpenAPI summary: phased uploads up to **50 products/batch**; last-batch indicator; staging until last batch.',
  '',
  'Conceptually **separate** from InsightBooks accounting Opening Stock.',
  '',
  'Open questions: reset/re-upload, GS1 barcode rules, services applicability, duplicate protection — see clarifications.',
]);

doc('SITE_PRODUCT_SERVICE_CONTRACT.md', 'Site Product and Service Contract', [
  '## Method resolution',
  '',
  '| Source | Method | Route |',
  '|---|---|---|',
  '| OpenAPI | **POST** | /api/v1/utilities/get-terminal-site-products |',
  '| Pre-integration guide text | **GET** (documentation) | same path |',
  '',
  '**Phase 1 position:** Prefer OpenAPI **POST**. Classify production use as REQUIRES_MRA_CLARIFICATION / sandbox proof. Do not treat GET and POST as equally valid.',
]);

doc('SALES_TRANSACTION_CONTRACT.md', 'Sales Transaction Contract', [
  '`POST /api/v1/sales/submit-sales-transaction` body SalesInvoice',
  '',
  '## Header required (OpenAPI)',
  '',
  'invoiceNumber, invoiceDateTime, sellerTIN, siteId, globalConfigVersion, taxpayerConfigVersion, terminalConfigVersion',
  '',
  '## Header optional',
  '',
  'buyerTIN, buyerName, buyerAuthorizationCode, isExport, isReliefSupply, vat5CertificateDetails, paymentMethod',
  '',
  '## Lines',
  '',
  'id, productCode, description, unitPrice, quantity, discount, total, totalVAT, taxRateId, isProduct — OpenAPI has no required[] on LineItemDto (guide may mandate).',
  '',
  '## Summary',
  '',
  'taxBreakDown required; levyBreakDown, totalVAT, offlineSignature, invoiceTotal, amountTendered optional in schema.',
  '',
  '## Math',
  '',
  'Exact formulas/rounding: **RC** — block payload implementation until clarified + sandbox examples. Do not use IEEE float for money in later phases.',
]);

doc('SALES_RESPONSE_CONTRACT.md', 'Sales Response Contract', [
  'InvoiceResponse: validationURL, shouldDownloadLatestConfig, shouldBlockTerminal, validationErrors[]',
  '',
  '## Outcome classes (engineering mapping pending sandbox)',
  '',
  'ACCEPTED · REJECTED · RETRYABLE_FAILURE · UNKNOWN_OUTCOME · BLOCKED · CONFIGURATION_REFRESH_REQUIRED',
  '',
  'Do not infer acceptance from URL alone until confirmed.',
]);

doc('LAST_ONLINE_TRANSACTION_CONTRACT.md', 'Last Online Transaction Contract', [
  '`POST /api/v1/sales/last-submitted-online-transaction` — no body in OpenAPI.',
  '',
  'Use for reconciliation; match on fiscal number + time + TIN + site + totals + config versions — **not amount alone**.',
  '',
  'Scope/retention/rate limits: RC.',
]);

doc('LAST_OFFLINE_TRANSACTION_CONTRACT.md', 'Last Offline Transaction Contract', [
  '`POST /api/v1/sales/last-submitted-offline-transaction`',
  '',
  'Supports crash recovery / queue reconciliation together with offlineSignature fields. Exact semantics RC pending sandbox.',
]);

doc('B2B_TRANSACTION_CONTRACT.md', 'B2B Transaction Contract', [
  'Fields: buyerTIN, buyerName, buyerAuthorizationCode',
  '',
  'Utilities: validate-authorization-code; check-tin-authorization-requirement',
  '',
  'Protected TIN / auth code lifetime/reuse: RC. Mask codes; minimize retention. Distinguish seller reporting vs buyer stock introduction.',
]);

doc('VAT5_RELIEF_CONTRACT.md', 'VAT5 Relief Contract', [
  'When isReliefSupply: validate via POST validate-vat5-certificate {projectNumber, certificateNumber, quantity}.',
  '',
  'Guide: certificate reusable until quantity consumed; validate before processing relief sale; remove VAT on standard-rated items under certificate rules.',
  '',
  'Concurrency/overuse risk: document as HIGH risk; not fully specified — RC.',
  '',
  'Do not equate VAT5 with all exempt/zero-rated supplies.',
]);

doc('PAYMENT_METHOD_CONTRACT.md', 'Payment Method Contract', [
  'OpenAPI: paymentMethod string nullable — **no enum**.',
  '',
  'Do not invent Cash/Card/Mobile Money enums from labels. Split payment / credit sale representation: RC.',
  '',
  'amountTendered optional in schema; business mandatoryness RC.',
]);

doc('FISCAL_NUMBERING_CONTRACT.md', 'Fiscal Numbering Contract', [
  '## Algorithm (Developer Guide)',
  '',
  'Components: TaxpayerID, TerminalPosition, JulianDate, Count → each Base10→Base64 → join with `-`.',
  '',
  'JulianDate: guide provides C# ToJulianDate algorithm (Gregorian JD style).',
  '',
  '## Independent verification status',
  '',
  '| Check | Result |',
  '|---|---|',
  '| Official worked numeric example reproduced | **NOT COMPLETE** — exact integer byte encoding for Base64 unclear |',
  '| Legacy InsightBooks format TIN-pos-YYYYMMDD-seq | **INCOMPATIBLE** with guide |',
  '',
  '**BLOCK implementation** until examples reproduce exactly (clarification Q-021).',
]);

doc('RECEIPT_AND_QR_REQUIREMENTS.md', 'Receipt and QR Requirements', [
  'FAQ: unique number + QR; scan shows details verifiable in Backoffice.',
  '',
  'Sales response provides validationURL for QR/link.',
  '',
  'Mandatory field list for print: partially documented across FAQ/guide — compile during certification review. Do not label receipt “MRA validated” before acceptance or certified offline issuance.',
  '',
  'Multi-currency: not supported (FAQ).',
]);

doc('OFFLINE_MODE_REQUIREMENTS.md', 'Offline Mode Requirements', [
  'FAQ: desktop/mobile POS offline invoicing; internet for sync.',
  '',
  'Guide: offline thresholds, offlineSignature, later submit online.',
  '',
  '**Certification:** offline capability requires MRA certification — do not enable before approval.',
  '',
  'Blocked-terminal offline behaviour: RC — do not assume allowed.',
]);

doc('OFFLINE_SIGNATURE_CONTRACT.md', 'Offline Signature Contract', [
  'HMAC-SHA256 over query params; URL-safe Base64; stored as offlineSignature.',
  '',
  'Exact param names/order/formatting: extract from signing_offline_receipts guide; **reproduction incomplete** → offline implementation BLOCKED until KAT passes.',
]);

doc('OFFLINE_THRESHOLD_CONTRACT.md', 'Offline Threshold Contract', [
  'From terminalConfiguration.offlineLimit:',
  '',
  '- maxTransactionAgeInHours',
  '- maxCummulativeAmount (OpenAPI spelling)',
  '',
  'Zero meaning (unlimited vs disabled): **RC — do not interpret as unlimited**.',
  '',
  'Scope (per terminal/site/outage) RC.',
]);

doc('TERMINAL_BLOCKING_CONTRACT.md', 'Terminal Blocking Contract', [
  'Sales data.shouldBlockTerminal boolean.',
  '',
  'Utilities: get-terminal-blocking-message; check-terminal-unblock-status.',
  '',
  'Do not continue offline after block without MRA confirmation. Polling cadence RC.',
]);

doc('PING_AND_HEALTH_CONTRACT.md', 'Ping and Health Contract', [
  '`POST /api/v1/utilities/ping` — PongResponse. HTTP 200/400/503.',
  '',
  'Do not use localhost sample URLs. Auth requirement for ping: OA. Frequency/rate limits: RC.',
]);

doc('API_ENVIRONMENT_MATRIX.md', 'API Environment Matrix', [
  '| Env | Base URL | Portal | Status ${ACCESS} |',
  '|---|---|---|---|',
  '| Sandbox API | https://dev-eis-api.mra.mw | https://dev-eis-portal.mra.mw | Up (public) |',
  '| Production API | https://eis-api.mra.mw | https://eis-portal.mra.mw | Up (public) |',
  '| Validation (sample hosts) | eservices.mra.mw/doc/v/ ; portal ReceiptValidation | — | Documented in samples |',
  '| Certification | Same sandbox/manual inspection at MRA | — | Guide |',
  '',
  'Do not assume identical contracts forever — re-diff OpenAPI each phase.',
]);

doc('API_VERSIONING_RESEARCH.md', 'API Versioning Research', [
  'URL prefix `/api/v1`. OpenAPI info.version 1.0. Guide “API v1”.',
  '',
  'Deprecation/notification process: not documented — RC.',
  '',
  'productVersion changes may require re-certification (guide implies certification per software version).',
]);

doc('RATE_LIMIT_AND_SERVICE_RESEARCH.md', 'Rate Limit and Service Research', [
  'Not documented in OpenAPI. Inventory batch max 50 stated. Warehouse pageSize max 200.',
  '',
  'All other limits → clarification questions. Internal engineering defaults must be labeled as such.',
]);

doc('IDEMPOTENCY_AND_DUPLICATE_RESEARCH.md', 'Idempotency and Duplicate Research', [
  '| Operation | Classification |',
  '|---|---|',
  '| activate-terminal | NOT_IDEMPOTENT / UNKNOWN — TAC single-use risk |',
  '| confirmation | UNKNOWN |',
  '| submit-sales | REQUIRES_RECONCILIATION via invoiceNumber + last-online |',
  '| get-latest-configs | NATURALLY_IDEMPOTENT (read) |',
  '| initial inventory batch | UNKNOWN |',
  '| ping | NATURALLY_IDEMPOTENT |',
  '',
  'No idempotency-key header in OpenAPI.',
]);

doc('TIMEOUT_AND_UNKNOWN_OUTCOME_RESEARCH.md', 'Timeout and Unknown Outcome Research', [
  'For write endpoints: prefer reconcile via last-online/offline + get-invoice-by-number rather than blind retry.',
  '',
  'Activation timeout recovery: **no official recovery op found** — Q-016 BLOCKING.',
  '',
  'Correlation ID: not in OpenAPI.',
]);

doc('RECEIPT_CANCELLATION_AND_CORRECTIONS_RESEARCH.md', 'Receipt Cancellation and Corrections', [
  '## API-documented',
  '',
  '- POST cancel-receipt (VoidReceiptCreateDto)',
  '- POST get-void-receipts',
  '- POST process-credit-debit-note (higher VAT/total → debit; lower → credit)',
  '',
  '## Not to invent',
  '',
  'Negative sales payloads, ad-hoc refund endpoints, undocumented correction flows.',
  '',
  'Portal-only processes may exist — RC for full refund/return matrix. Mark unsupported flows BLOCKED pending MRA guidance.',
]);

doc('DATA_RETENTION_AND_AUDIT_RESEARCH.md', 'Data Retention and Audit Research', [
  'Legal retention periods: **not extracted from Regulations text** — counsel (LQ-004).',
  '',
  'Engineering: retain fiscal numbers, validation URLs, request/response metadata (redacted), config versions, mappings; **do not retain secrets** merely because invoices retained.',
]);

doc('SECURITY_THREAT_MODEL.md', 'Security Threat Model', [
  '| Threat ID | Actor | Asset | Attack | Impact | MRA control | IB control (later) | Phase |',
  '|---|---|---|---|---|---|---|---|',
  '| T-001 | External | JWT/secretKey | Theft from logs | Fiscal fraud | TLS | Encrypt, no log | 3+ |',
  '| T-002 | Tenant admin | Terminal creds | Cross-tenant use | Multi-tenant breach | Terminal binding | Strict tenant isolation | 3+ |',
  '| T-003 | Attacker | Payload | Tamper without hash | Invalid invoice | Server validation | Optional hash if proven | 3+ |',
  '| T-004 | Insider | Fiscal numbers | Collision/reuse | Duplicate fiscal | Server reject? | Strong sequencer | 3+ |',
  '| T-005 | Operator | Offline queue | Tamper/omit | Tax evasion | Offline sig | Signed queue, audit | Cert |',
  '| T-006 | Attacker | VAT5 | Overuse | Tax loss | Validate endpoint | Concurrency locks | 3+ |',
  '| T-007 | Attacker | QR | Substitution | Fake receipt | Validation site | Print from accepted URL only | 3+ |',
  '| T-008 | Support | Secrets | Impersonation | Full compromise | — | Break-glass audit | 3+ |',
]);

doc('PRIVACY_AND_DATA_CLASSIFICATION.md', 'Privacy and Data Classification', [
  '| Field | Class | Storage | Log | UI |',
  '|---|---|---|---|---|',
  '| sellerTIN / buyerTIN | CONFIDENTIAL | Encrypted/restricted | Mask | Need-to-know |',
  '| buyerAuthorizationCode | SECRET | Minimize TTL | Never | Mask |',
  '| JWT / secretKey / TAC | SECRET / SHORT_LIVED | HSM/secret store | Never | Never |',
  '| VAT5 details | CONFIDENTIAL | Restricted | Mask | Need-to-know |',
  '| validationURL | INTERNAL | OK | OK | Receipt |',
  '| Invoice lines | CONFIDENTIAL | Tenant DB | Limited | Role-based |',
]);

doc('API_COMPLIANCE_CERTIFICATION_RESEARCH.md', 'API Compliance Certification Research', [
  'Guide §7: All non-MRA POS must be certified; software provider + software; productID + productVersion; recorded in POS/vendor repositories; certification revocable; blocking for non-compliance/malware.',
  '',
  'Process §7.2: Bring software to MRA for manual inspection/testing against API standards; pass → certificate + IDs.',
  '',
  'Pre-integration: sandbox portal registration + inventory approved.',
  '',
  '**InsightBooks is not MRA certified** until written approval.',
]);

doc('CERTIFICATION_EVIDENCE_CHECKLIST.md', 'Certification Evidence Checklist', [
  '- [ ] Developer registration sandbox',
  '- [ ] Test TIN / terminal / TAC',
  '- [ ] productID / productVersion issued',
  '- [ ] Online sales test cases',
  '- [ ] Offline certification (if claimed)',
  '- [ ] Receipt/QR review',
  '- [ ] Security review',
  '- [ ] Manual inspection meeting',
  '- [ ] Written compliance certificate',
  '- [ ] Production onboarding approval',
  '- [ ] Re-certification process documented for version bumps',
]);

console.log('part3a', written.length);
fs.writeFileSync(path.join(__dirname, '_written.json'), JSON.stringify(written, null, 2));
module.exports = { doc, written, conf, ACCESS };
