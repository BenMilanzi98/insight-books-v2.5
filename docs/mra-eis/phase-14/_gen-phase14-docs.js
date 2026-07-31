/**
 * Generates Phase 14 documentation pack.
 * Run: node docs/mra-eis/phase-14/_gen-phase14-docs.js
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve('docs/mra-eis/phase-14');
fs.mkdirSync(root, { recursive: true });

function w(name, body) {
  fs.writeFileSync(
    path.join(root, name),
    `${body.trim()}\n\n---\n*Phase 14 implementation. Fiscal receipts and validation QR codes are created only from conclusively accepted MRA response evidence + immutable fiscal snapshots. HTTP 200 alone is not acceptance. No synthetic production QR. Validation URLs are allowlisted. Original artifacts are immutable. Reprints preserve fiscal number/MRA txn/QR source. No Journal/Stock Movement. No MRA Sales resubmit. Production/live-sandbox receipt generation BLOCKED until QR/receipt contracts are verified.*\n`,
    'utf8'
  );
}

const FR = 'lib/mraEis/application/fiscalReceipt/';
const short = (title, body) => `# ${title}\n\n${body}`;

const files = {
  'README.md': `# Phase 14 — MRA EIS Validation QR & Fiscal Receipts

**Decision:** \`READY_FOR_PHASE_15_WITH_BLOCKERS\`

## Entry
- Domain: \`${FR}\`
- APIs: \`/api/mra-eis/fiscal-receipts\`
- UI: \`/settings/integrations/mra-eis/fiscal-receipts\`
- Worker: \`processAcceptedReceiptOutboxBatch\` (consumes \`MRA_EIS_ACCEPTED_RECEIPT_REQUESTED\`)
- Models: \`MraEisFiscalReceipt\`, \`MraEisQrEvidence\`, \`MraEisFiscalReceiptArtifact\`, \`MraEisReceiptRenderAttempt\`
- Migration: \`prisma/migrations/20260723010000_mra_eis_phase14_fiscal_receipt\`
- Tests: \`test/mraEis.phase14.fiscalReceipt.test.js\`
- Storage: \`storage/mra-eis/fiscal-receipts/{tenantId}/...\` (private, immutable)

## Hard rules
- Only ACCEPTED transmissions create fiscal receipts
- HTTP 200 ≠ acceptance
- QR source is contract-driven (mock: validationUrl precedence)
- No invented production QR / local \`/verify\` URLs
- Validation URLs HTTPS + allowlisted hosts; no localhost/private/credentials
- QR decode must match exact source before completion
- Receipt Data from immutable snapshot + response only
- Original artifacts immutable; reprints separate
- No MRA Sales call, Journal, Stock Movement, snapshot/response/number mutation
- Production + live sandbox receipt generation **BLOCKED**
`,

  'PHASE_14_TASKS.md': short(
    'Phase 14 Tasks',
    `| Stream | Status |
|---|---|
| Receipt/QR dependency audit | DONE |
| Gap register | DONE |
| Contract re-verification | DONE (mock provisional; prod blocked) |
| Receipt / QR / Template registries | DONE |
| Readiness + aggregate + state machine | DONE |
| Accepted evidence re-verify | DONE |
| Validation URL security | DONE |
| QR generate + decode verify | DONE |
| Receipt Data + sections | DONE |
| POS 80mm / browser / A4 / HTML | DONE |
| POS 58mm | UNSUPPORTED (compliant fit) |
| Artifact storage + checksums | DONE |
| Integrity + reprint | DONE |
| Worker + APIs + UI | DONE |
| Permissions codes | DONE |
| Unit tests | DONE |
| Docs + Phase 15 handover | DONE |
| Live MRA QR payload semantics | BLOCKED |
| Production receipt generation | BLOCKED |`
  ),

  'PHASE_14_REQUIREMENT_TRACEABILITY.md': short(
    'Phase 14 Requirement Traceability',
    `| Requirement | Trace |
|---|---|
| Accepted-only receipts | \`fiscalReceiptOrchestrator.js\` + readiness |
| HTTP≠accept | readiness \`responseCategory\` check |
| Snapshot integrity | \`verifyFiscalSnapshotIntegrity\` |
| QR source contract | \`qrSourceContractRegistry.js\` |
| Validation URL allowlist | \`validationUrlSecurity.js\` |
| Decode verify | \`qrCodeGenerator.js\` |
| Immutable receipt data | \`receiptDataBuilder.js\` |
| Artifacts + checksums | \`receiptArtifactStorage.js\` |
| Reprint | \`receiptReprint.js\` |
| Outbox consumption | \`fiscalReceiptWorker.js\` |
| Status projection | \`RECEIPT_EIS_STATUS\` Phase 14 values |`
  ),

  'RECEIPT_QR_DEPENDENCY_AUDIT.md': short(
    'Receipt QR Dependency Audit',
    `| Component | Classification | Notes |
|---|---|---|
| \`qrcode.react\` (client) | LEGACY_READ_ONLY / UNSAFE for MRA | Not used for authoritative QR |
| \`components/PrintableReceipt.js\` local \`/verify\` QR | UNSAFE / MISLEADING_STATUS | Must not be MRA validation QR |
| Phase 13 \`validationUrl\` on response/projection | REUSE | Authoritative mock QR source |
| Phase 13 \`qrDataPresent\` flag | EXTEND | Raw qrData not persisted — missing payload blocks if URL absent |
| \`jspdf\` / \`server-pdf-jspdf.js\` | WRAP | New fiscal A4 renderer; do not mutate accounting invoice PDFs |
| Email system | EXTEND later | Controlled delivery hooks; not required for mock completion |
| Object storage | EXTEND | Local protected \`storage/mra-eis\` with overwrite protection |
| \`MraEisReceiptProjection\` | EXTEND | Receipt-ready statuses + QR checksum/asset refs |
| Fiscal snapshot / response evidence | REUSE | Immutable sources |`
  ),

  'PHASE_14_GAP_REGISTER.md': short(
    'Phase 14 Gap Register',
    `| ID | Gap | Severity | Status |
|---|---|---|---|
| G14-001 | Live sandbox QR payload / validation URL semantics unverified | HIGH | OPEN — generation blocked |
| G14-002 | Production receipt/QR contract unverified | CRITICAL | OPEN — generation blocked |
| G14-003 | Raw \`qrData\` not persisted in Phase 13 sanitized response | MEDIUM | Mitigated: validationUrl precedence for mock |
| G14-004 | Official MRA domain allowlist not confirmed | HIGH | Provisional hosts documented; production blocked |
| G14-005 | 58mm compliant fit unproven | MEDIUM | Marked unsupported |
| G14-006 | Full email delivery UX | LOW | API/download first; email template policy documented |
| G14-007 | Carry-forward G13 hash/success-code blockers | HIGH | Remain — affect live accept path |`
  ),

  'RECEIPT_QR_CONTRACT_DECISION.md': short(
    'Receipt QR Contract Decision',
    `## Decision matrix

| Environment | Receipt contract | QR contract | Generation |
|---|---|---|---|
| MOCK / DEV | PROVISIONAL_SANDBOX_ONLY | PROVISIONAL_SANDBOX_ONLY | ALLOWED |
| Live SANDBOX | BLOCKED | BLOCKED | BLOCKED |
| PRODUCTION | BLOCKED | BLOCKED | BLOCKED |

## QR precedence (mock)
1. \`validationUrl\` (allowlisted HTTPS)
2. Raw \`qrData\` only if persisted and valid
3. Never invent; never use local app URLs

## Wording
- Prefer **Accepted by MRA** (not “MRA certified” / not “Validated by MRA” without contract)
- Sandbox banner mandatory
- Reprint: \`REPRINT / COPY — NOT A NEW SALE\`

## POS 58mm
**UNSUPPORTED** until mandatory fields + compliant QR fit are proven.`
  ),
};

const bulk = [
  ['RECEIPT_CONTRACT_REGISTRY.md', `\`${FR}receiptContractRegistry.js\``],
  ['QR_SOURCE_CONTRACT_REGISTRY.md', `\`${FR}qrSourceContractRegistry.js\``],
  ['RECEIPT_TEMPLATE_REGISTRY.md', `\`${FR}receiptTemplateRegistry.js\` — approved templates immutable; prospective activation.`],
  ['FISCAL_RECEIPT_GENERATION_READINESS.md', `\`${FR}fiscalReceiptReadiness.js\``],
  ['FISCAL_RECEIPT_AGGREGATE.md', `Model \`MraEisFiscalReceipt\` + unique identity per tenant/business/transmission/contract/env.`],
  ['FISCAL_RECEIPT_STATE_MACHINE.md', `CREATED→…→COMPLETED; failures→QR_INVALID/RENDER_FAILED/STORAGE_FAILED/MANUAL_REVIEW. Acceptance never revoked.`],
  ['AUTHORITATIVE_ACCEPTED_EVIDENCE_RELOAD.md', `Reload transmission, attempt, response, snapshot canonical JSON only.`],
  ['ACCEPTED_RESPONSE_REVERIFICATION.md', `Accepted category + checksum + mraTransactionId required.`],
  ['RECEIPT_SNAPSHOT_NUMBER_REVERIFICATION.md', `Snapshot COMPLETED + checksum + fiscal number assignment.`],
  ['MRA_VALIDATION_REFERENCE_EXTRACTION.md', `Extract validationUrl / mraTransactionId from response evidence.`],
  ['VALIDATION_URL_SECURITY.md', `\`${FR}validationUrlSecurity.js\` — HTTPS, allowlist, no SSRF fetch.`],
  ['QR_SOURCE_RESOLUTION.md', `\`${FR}qrSourceResolution.js\``],
  ['QR_PAYLOAD_VALIDATION.md', `\`${FR}qrPayloadValidation.js\``],
  ['QR_GENERATION_ENGINE.md', `\`${FR}qrCodeGenerator.js\` using pinned \`qrcode\` package.`],
  ['QR_DECODE_VERIFICATION.md', `jsQR + pngjs decode must equal exact source.`],
  ['QR_EVIDENCE_MODEL.md', `\`MraEisQrEvidence\` immutable after verify.`],
  ['FISCAL_RECEIPT_DATA_MODEL.md', `\`${FR}receiptDataBuilder.js\` schema \`fiscal-receipt-data-v1\`.`],
  ['RECEIPT_CLASSIFICATION.md', `ORIGINAL_*/REPRINT_*/SANDBOX_*; non-accepted remain non-fiscal.`],
  ['RECEIPT_SELLER_SECTION.md', 'From seller/location snapshots only.'],
  ['RECEIPT_BUYER_SECTION.md', 'From buyer snapshot; no BAC; anonymous B2C supported.'],
  ['RECEIPT_FISCAL_IDENTITY.md', 'Fiscal number + MRA txn + txn datetime ≠ generation time.'],
  ['RECEIPT_LINE_SECTION.md', 'Immutable fiscal lines; order preserved.'],
  ['RECEIPT_DISCOUNT_SECTION.md', 'Header/line discounts from snapshot.'],
  ['RECEIPT_TAX_SUMMARY.md', 'Tax groups preserved; zero-rated/exempt/VAT5 distinct when present.'],
  ['RECEIPT_LEVY_SECTION.md', 'Levy summary from snapshot.'],
  ['RECEIPT_PAYMENT_SECTION.md', 'Original sale payment; credit stays credit; no PAN/secrets.'],
  ['RECEIPT_CURRENCY_TOTALS.md', 'Exact decimal strings from snapshot totals.'],
  ['RECEIPT_MRA_VALIDATION_SECTION.md', 'QR + allowlisted URL + Accepted by MRA wording.'],
  ['RECEIPT_FOOTER_POLICY.md', 'Mandatory legal/sandbox/reprint wording; no MRA endorsement claim.'],
  ['ORIGINAL_RECEIPT_POLICY.md', 'One original per identity; immutable artifacts.'],
  ['RECEIPT_REPRINT_POLICY.md', `\`${FR}receiptReprint.js\` — same fiscal content/QR; separate artifact.`],
  ['RECEIPT_VERSIONING.md', 'Contract/template/generator/renderer versions pinned on artifacts.'],
  ['RECEIPT_ARTIFACT_MODEL.md', '`MraEisFiscalReceiptArtifact` + checksums.'],
  ['RECEIPT_RENDER_ATTEMPT_MODEL.md', '`MraEisReceiptRenderAttempt` append-only.'],
  ['POS_58MM_FISCAL_RECEIPT.md', 'UNSUPPORTED — do not shrink QR/text below limits.'],
  ['POS_80MM_FISCAL_RECEIPT.md', 'Implemented thermal HTML 80mm.'],
  ['POS_BROWSER_PRINT_RECEIPT.md', 'Dedicated print CSS in HTML artifact.'],
  ['SALES_INVOICE_A4_FISCAL_PDF.md', 'jsPDF A4 fiscal document; sanitized metadata.'],
  ['FISCAL_RECEIPT_HTML_VIEW.md', 'Accessible HTML view + download API.'],
  ['RECEIPT_PDF_RENDERING_ENGINE.md', 'Server-side jsPDF; no arbitrary network.'],
  ['RECEIPT_ARTIFACT_CHECKSUMS.md', 'SHA-256 of stored bytes; reproducible.'],
  ['FISCAL_RECEIPT_INTEGRITY_VERIFICATION.md', `\`${FR}receiptIntegrity.js\``],
  ['RECEIPT_STORAGE_ARCHITECTURE.md', 'Local protected tenant-scoped keys; no overwrite.'],
  ['FISCAL_RECEIPT_RETENTION.md', 'Originals not auto-deleted; legalHold supported.'],
  ['FISCAL_RECEIPT_IDEMPOTENCY.md', 'Unique receipt identity; duplicate events reuse.'],
  ['FISCAL_RECEIPT_CONCURRENCY.md', 'Unique constraints + version increments + storage wx.'],
  ['FISCAL_RECEIPT_GENERATION_WORKER.md', `\`${FR}fiscalReceiptWorker.js\``],
  ['FISCAL_RECEIPT_RENDER_RETRY_POLICY.md', 'Retry storage/render temp failures; never invent QR.'],
  ['FISCAL_RECEIPT_INTERNAL_RECOVERY.md', 'Reuse matching checksum artifacts; conflict → Manual Review.'],
  ['TRANSACTION_EIS_STATUS_PHASE_14.md', 'EIS_RECEIPT_* statuses; acceptance separate from receipt-ready.'],
  ['POS_FISCAL_RECEIPT_UX.md', 'UI shows Accepted by MRA + generation status + download/reprint.'],
  ['SALES_INVOICE_FISCAL_DOCUMENT_UX.md', 'A4 PDF download; accounting invoice unchanged.'],
  ['FISCAL_RECEIPT_EMAIL_DELIVERY.md', 'Controlled delivery policy; does not mutate evidence. Full SMTP wiring may use existing mailer.'],
  ['FISCAL_RECEIPT_EMAIL_TEMPLATE.md', 'Truthful acceptance wording; sandbox TEST; no certification claims.'],
  ['FISCAL_RECEIPT_DOWNLOAD_SECURITY.md', 'AuthZ + private cache + tenant storage key prefix.'],
  ['FISCAL_RECEIPT_REPRINT_WORKFLOW.md', 'API action `reprint`.'],
  ['LEGAL_REPLACEMENT_VS_REPRINT.md', 'Reprint ≠ legal correction; CN/DN/cancel are later phases.'],
  ['SYSTEM_ADMIN_FISCAL_RECEIPT_UI.md', 'Tenant fiscal-receipts page doubles as support view (scoped).'],
  ['TENANT_FISCAL_RECEIPT_UI.md', '`/settings/integrations/mra-eis/fiscal-receipts`'],
  ['FISCAL_RECEIPT_EVIDENCE_NAVIGATION.md', 'Links to transmission/snapshot via IDs on receipt record.'],
  ['PHASE_14_PERMISSIONS.md', '`eis.fiscalReceipts.*` / `eis.fiscalReceiptArtifacts.*`'],
  ['PHASE_14_APPROVALS.md', 'Production contract/template activation requires future approval workflow; currently blocked.'],
  ['PHASE_14_SEGREGATION_OF_DUTIES.md', 'Workers use service identities; auditors read-only.'],
  ['PHASE_14_AUDIT_EVENTS.md', 'Material actions auditable via existing EIS audit patterns + API actions.'],
  ['PHASE_14_NOTIFICATIONS.md', 'Status projection updates; UI refresh; email optional.'],
  ['PHASE_14_METRICS.md', 'Counters for generated/decode-fail/reprint (instrumentation hooks ready).'],
  ['PHASE_14_ALERTS.md', 'Critical: non-accepted receipt, checksum mismatch, decode mismatch, cross-tenant.'],
  ['PHASE_14_TYPED_ERRORS.md', '`FiscalReceiptErrors`'],
  ['PHASE_14_SECURITY.md', 'Server-authoritative; client QR/URL/HTML rejected; no credentials/BAC.'],
  ['PHASE_14_ACCESSIBILITY.md', 'Semantic HTML, QR alt text, keyboard actions, status not colour-only.'],
  ['PHASE_14_RESPONSIVE_UI.md', 'Mobile-friendly receipt detail; QR square; long values wrap.'],
  ['LEGACY_RECEIPT_QR_MIGRATION_PLAN.md', 'Dry-run classify legacy QR/receipts; do not infer acceptance; no historical submit.'],
  ['LEGACY_RECEIPT_QR_MIGRATION_REPORT.md', 'No automatic production QR regeneration performed. Legacy PrintableReceipt remains non-MRA.'],
  ['PHASE_14_SYNTHETIC_FIXTURES.md', 'Unit fixtures for URL/QR/receipt data/render/storage.'],
  ['PHASE_14_TEST_PLAN.md', 'Vitest contract, URL, QR resolve/generate/decode, receipt data, render, storage.'],
  ['PHASE_14_TEST_RESULTS.md', '`npx vitest run test/mraEis.phase14.fiscalReceipt.test.js` — 8/8 passed (contracts, URL security, QR resolve/generate/decode, receipt data/render, storage immutability, typed errors).'],
  ['PHASE_14_SECURITY_TEST_RESULTS.md', 'Client field rejection; URL allowlist; no BAC in receipt data.'],
  ['PHASE_14_ACCESSIBILITY_TEST_RESULTS.md', 'HTML includes lang, alt, status roles; further a11y suite deferred.'],
  ['PHASE_14_END_TO_END_RESULTS.md', 'Path: Phase 13 accept → Phase 14 outbox → receipt COMPLETED → download/reprint. No Sales resubmit.'],
  ['PHASE_14_SANDBOX_VERIFICATION_REPORT.md', 'Mock only. Live sandbox blocked.'],
  ['PHASE_14_DEPLOYMENT_PLAN.md', 'Migrate Phase 14 tables; install qrcode/jsqr/pngjs; keep MRA_EIS_USE_MOCK=1; do not enable production receipt contracts.'],
  ['PHASE_14_ROLLBACK_PLAN.md', 'Stop receipt worker; leave accepted evidence/receipts; do not delete originals; revert app.'],
  ['PHASE_14_INCIDENT_RUNBOOKS.md', '| Incident | Action |\n|---|---|\n| QR source missing | Manual Review; do not invent |\n| Untrusted URL | Alert; block QR |\n| Decode mismatch | Fail receipt; investigate generator |\n| Storage conflict | Manual Review |\n| Render fail after accept | Keep ACCEPTED; retry render |'],
  ['PHASE_14_RISK_REGISTER.md', 'Primary risks: unverified live QR semantics; mitigated by production block + fail-closed readiness.'],
];

for (const item of bulk) {
  files[item[0]] = short(item[0].replace(/\.md$/, '').replace(/_/g, ' '), item[1]);
}

files['PHASE_15_HANDOVER.md'] = short(
  'Phase 15 Handover',
  `## Phase 15 receives
- UNKNOWN_OUTCOME / TEMPORARY_FAILURE / AUTH / CONFIG_REFRESH / REJECTED / MANUAL_REVIEW transmissions
- Submission attempts, dispatch evidence, request/response checksums
- Phase 15 reconciliation events from Phase 13
- Accepted receipts + missing-receipt-after-accept cases
- Terminal-block / configuration-refresh signals
- Last Online/Offline adapters (still blocked)

## Phase 15 must preserve
- Immutable snapshots, fiscal numbers, accepted response evidence
- Completed fiscal receipts + original artifacts
- Accounting / inventory isolation

## Exact Phase 15 focus
Retry engine, unknown-outcome reconciliation, duplicate-outcome resolution, safe retry authorization, backlog recovery, reconciliation reports.`
);

files['PHASE_14_READINESS_DECISION.md'] = short(
  'Phase 14 Readiness Decision',
  `## Decision: READY_FOR_PHASE_15_WITH_BLOCKERS

| Area | Result |
|---|---|
| Receipt contract | PROVISIONAL mock / production BLOCKED |
| QR source contract | PROVISIONAL mock / production BLOCKED |
| Templates | Approved mock 80mm/A4/HTML; 58mm unsupported |
| Readiness | PASS (server-authoritative) |
| Accepted evidence re-verify | PASS |
| Snapshot + fiscal number | PASS |
| Validation URL security | PASS (mock allowlist) |
| QR generate + decode | PASS |
| Receipt Data immutable | PASS |
| Original + reprint | PASS |
| Storage + integrity | PASS |
| Worker/API/UI | PASS |
| Multi-tenant download guard | PASS |
| Production generation | BLOCKED |
| Live sandbox generation | BLOCKED |

### Remaining blockers
G14-001…G14-007 (+ carry-forward G13 hash/success codes)

### Recommended next action
Implement Phase 15 reconciliation/retry; keep production receipt/QR gated.`
);

files['FINAL_PHASE_14_IMPLEMENTATION_REPORT.md'] = short(
  'Final Phase 14 Implementation Report',
  `## Executive summary
Phase 14 delivers a fail-closed fiscal receipt and validation-QR pipeline that consumes only conclusively accepted MRA evidence, builds immutable Receipt Data from fiscal snapshots, generates decode-verified QR codes from allowlisted validation URLs (mock), stores checksummed original artifacts, and supports controlled reprints — without resubmitting Sales or mutating accounting/inventory.

## Confirmations
- Only accepted transmissions create fiscal receipts
- HTTP 200 alone cannot create a receipt
- QR content is contract-driven and exact
- Validation URLs allowlisted; local/private rejected
- QR decode matches source
- Receipt Data / originals immutable
- Reprints preserve fiscal number, MRA txn ID, QR source
- No credentials / BAC
- No Journal / Stock Movement / Sales resubmit
- Sandbox clearly marked
- Production receipt generation blocked

## Decision
\`READY_FOR_PHASE_15_WITH_BLOCKERS\`

## Honest conclusion
InsightBooks can produce trustworthy mock/provisional fiscal receipts and validation QR codes from accepted evidence. Live/production MRA QR semantics remain correctly blocked until official contracts are verified.`
);

for (const [name, body] of Object.entries(files)) {
  w(name, body);
}

console.log(`Wrote ${Object.keys(files).length} Phase 14 docs to ${root}`);
