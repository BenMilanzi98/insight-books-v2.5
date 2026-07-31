/**
 * Generates Phase 13 documentation pack.
 * Run: node docs/mra-eis/phase-13/_gen-phase13-docs.js
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve('docs/mra-eis/phase-13');
fs.mkdirSync(root, { recursive: true });

function w(name, body) {
  fs.writeFileSync(
    path.join(root, name),
    `${body.trim()}\n\n---\n*Phase 13 implementation. Online Sales transmission over immutable fiscal snapshots. HTTP 200 alone is not acceptance. Production/live sandbox blocked until x-eis-message-hash and success codes verified. No QR image or final fiscal receipt. No Journal/Stock Movement. Legacy eisService.submitInvoice disabled (410) unless MRA_EIS_ALLOW_LEGACY_DIRECT_SALES=1.*\n`,
    'utf8'
  );
}

const ST = 'lib/mraEis/application/salesTransmission/';
const short = (title, body) => `# ${title}\n\n${body}`;

const files = {
  'README.md': `# Phase 13 — MRA EIS Sales Payload Mapping & Online Transmission

**Decision:** \`READY_FOR_PHASE_14_WITH_BLOCKERS\`

## Entry
- Domain: \`${ST}\`
- Client: \`lib/mraEis/infrastructure/mraClient/salesClient.js\`
- Mock: \`lib/mraEis/infrastructure/mraClient/mockMraSalesServer.js\`
- APIs: \`/api/mra-eis/sales-transmission\`
- UI: \`/settings/integrations/mra-eis/sales-transmission\`
- Worker: \`processSalesPayloadOutboxBatch\`
- Tests: \`test/mraEis.phase13.salesTransmission.test.js\`
- Outbox: \`MRA_EIS_ACCEPTED_RECEIPT_REQUESTED\` (Phase 14), \`MRA_EIS_TRANSMISSION_RECONCILIATION_REQUESTED\` (Phase 15)

## Hard rules
- Source = completed immutable Fiscal Snapshot only
- Exact transmitted bytes hashed once (mock synthetic SHA-256; live hash blocked)
- JWT leased server-side / mock synthetic — never in DB/Jobs/Outbox/logs
- HTTP 200 ≠ acceptance
- No QR / final receipt
- No Journal / Stock Movement
- Accepted never resubmitted; UNKNOWN never blindly retried
- Production + live sandbox transmission **BLOCKED**
`,

  'PHASE_13_TASKS.md': short('Phase 13 Tasks', `| Stream | Status |
|---|---|
| Transmission forensic audit | DONE |
| Gap register | DONE |
| Endpoint/payload/response registries | DONE |
| Readiness + config compatibility | DONE |
| Mapper + validation + evidence | DONE |
| Message hash (mock / fail-closed live) | DONE |
| JWT lease + HTTP client | DONE |
| Attempt/response/classification | DONE |
| Accepted/Rejected/Unknown processing | DONE |
| Phase 14/15 outbox events | DONE |
| Worker + APIs + UI | DONE |
| Disable legacy direct submit | DONE |
| Unit tests | DONE |
| Docs + Phase 14 handover | DONE |
| Live MRA sandbox Sales | BLOCKED |
| QR / receipt | PHASE 14 |`),

  'PHASE_13_REQUIREMENT_TRACEABILITY.md': short(
    'Phase 13 Requirement Traceability',
    `| Requirement | Trace |
|---|---|
| Endpoint path POST submit-sales-transaction | \`salesEndpointContractRegistry.js\` |
| Request hash | Mock synthetic / live Q-010 fail-closed |
| Snapshot integrity | \`verifyFiscalSnapshotIntegrity\` |
| Payload mapping | \`salesPayloadMapper.js\` from canonicalSnapshot |
| Classification | \`applicationStatusClassifier.js\` |
| Transmission aggregate | Phase 5 \`MraEisTransmission\` EXTEND |
| Attempts/Responses | Phase 5 models |
| Phase 14 event | \`ACCEPTED_RECEIPT_REQUESTED\` |
| Phase 15 event | \`TRANSMISSION_RECONCILIATION_REQUESTED\` |
| Legacy disable | \`lib/eisService.js\` submitInvoice |`
  ),

  'SALES_TRANSMISSION_DEPENDENCY_AUDIT.md': short(
    'Sales Transmission Dependency Audit',
    `| Mechanism | Classification |
|---|---|
| Phase 5 Transmission/Attempt/Response | EXTEND |
| Phase 6 canonicalize | REUSE |
| Phase 6 hashEisMessage | FAIL_CLOSED / WRAP for mock |
| Phase 6 withSecret JWT | REUSE |
| Phase 7/8/10 MRA clients | REUSE pattern |
| Phase 12 snapshot + outbox | EXTEND |
| lib/eisService.submitInvoice | DISABLE (UNSAFE_DIRECT_CALL) |
| app/api/eis/* remaining | LEGACY_READ_ONLY / gate |
| Browser payload submit | UNSAFE — rejected by API |`
  ),

  'PHASE_13_GAP_REGISTER.md': short(
    'Phase 13 Gap Register',
    `| ID | Gap | Status |
|---|---|---|
| G13-001 | x-eis-message-hash algorithm (Q-010/Q-011) | REQUIRES_MRA_CLARIFICATION |
| G13-002 | Live application success-code catalogue | REQUIRES_MRA_CLARIFICATION |
| G13-003 | Duplicate Sales semantics | REQUIRES_MRA_CLARIFICATION |
| G13-004 | Production fiscal number (G12-001) | BLOCKED |
| G13-005 | VAT5 / Buyer Authorization live | BLOCKED |
| G13-006 | Live sandbox Sales enablement | BLOCKED until G13-001/002 |
| G13-007 | Full Prometheus metrics fan-out | INSUFFICIENT |
| G13-008 | System cross-tenant admin console | WRAP (tenant UI done) |
| G13-009 | Aggressive automatic retry scheduler | DEFERRED Phase 15 |`
  ),

  'SALES_ENDPOINT_CONTRACT_DECISION.md': short(
    'Sales Endpoint Contract Decision',
    `**Decision:** \`PROVISIONAL_SANDBOX_ONLY\`

- Path: \`POST /api/v1/sales/submit-sales-transaction\`
- Mock transmission: ALLOWED
- Live sandbox: BLOCKED
- Production: BLOCKED
- No automatic endpoint/method/hash fallback
- HTTP 200 alone is not acceptance`
  ),
};

// Bulk short docs for remaining required deliverables
const bulk = [
  ['SALES_ENDPOINT_CONTRACT_REGISTRY.md', 'Registry in `salesEndpointContractRegistry.js`. MOCK provisional; SANDBOX/PRODUCTION blocked.'],
  ['SALES_PAYLOAD_SCHEMA_REGISTRY.md', '`SALES_PAYLOAD_V1_PROVISIONAL` — header/buyer/lines/tax/levy/payment; unknown fields rejected.'],
  ['SALES_RESPONSE_SCHEMA_REGISTRY.md', '`SALES_RESPONSE_V1_PROVISIONAL` — applicationStatusField=responseCode; missing txn id blocks acceptance.'],
  ['ONLINE_TRANSMISSION_READINESS.md', '`evaluateOnlineSalesTransmissionReadiness` — integrity, number, terminal, contract, prior acceptance.'],
  ['CONFIGURATION_COMPATIBILITY_POLICY.md', 'Snapshot config refs retained; current config not substituted into payload. Refresh signal → Phase 8 event.'],
  ['SALES_TRANSMISSION_AGGREGATE.md', 'Phase 5 `MraEisTransmission` — one per snapshot+mode; ACCEPTED_ONLINE terminal.'],
  ['SALES_TRANSMISSION_STATE_MACHINE.md', 'Uses existing TRANSMISSION_TRANSITIONS; accepted cannot resubmit; unknown cannot auto-retry.'],
  ['SALES_TRANSMISSION_IDEMPOTENCY.md', 'Unique (snapshotId,mode); outbox idempotency; one accepted attempt; Phase 14 key per attempt.'],
  ['AUTHORITATIVE_SNAPSHOT_RELOAD.md', 'Reload snapshot+lines+canonical; never mutable Product/Customer/Business.'],
  ['SNAPSHOT_INTEGRITY_REVERIFICATION.md', 'Calls `verifyFiscalSnapshotIntegrity` before mapping.'],
  ['FISCAL_NUMBER_TRANSMISSION_VERIFICATION.md', 'Requires assignment on snapshot; Phase 13 never allocates a new number.'],
  ['MRA_SALES_HEADER_MAPPING.md', 'TIN, site, terminal, fiscal number, datetime, currency, totals, onlineIndicator.'],
  ['MRA_SELLER_MAPPING.md', 'From Seller Snapshot only; no secrets.'],
  ['MRA_BUYER_MAPPING.md', 'From Buyer Snapshot; BAC never mapped to persistence.'],
  ['BUYER_AUTHORIZATION_EPHEMERAL_OVERLAY.md', 'VAT5/BAC path blocked until verified; when enabled will use ephemeral secret lease only.'],
  ['MRA_PRODUCT_LINE_MAPPING.md', 'Immutable line evidence; deterministic order; no current price re-read.'],
  ['MRA_SERVICE_LINE_MAPPING.md', 'Service lines from snapshot; no invented inventory fields.'],
  ['MRA_PRODUCT_VARIANT_MAPPING.md', 'Variant IDs preserved in line evidence; external code from snapshot.'],
  ['MRA_BUNDLE_COMPOSITE_MAPPING.md', 'Uses Phase 12 stored policy; incomplete evidence blocks.'],
  ['MRA_DISCOUNT_MAPPING.md', 'Stored discount amounts; no invented balancing discounts.'],
  ['MRA_TAX_SUMMARY_MAPPING.md', 'From taxSummary snapshot; VAT5 distinct; zero-rated ≠ exempt.'],
  ['MRA_LEVY_MAPPING.md', 'From levySummary; no inventing levy IDs.'],
  ['MRA_VAT5_MAPPING.md', 'Blocked until live validation verified; not treated as ordinary zero-rated.'],
  ['MRA_PAYMENT_MAPPING.md', 'All components; Credit preserved; later collections ignored.'],
  ['MRA_AMOUNT_TENDERED_MAPPING.md', 'From payment snapshot; not invented from gross when required.'],
  ['MRA_CURRENCY_MAPPING.md', 'Immutable currency snapshot; no silent MWK conversion.'],
  ['ONLINE_OFFLINE_PAYLOAD_FIELDS.md', 'onlineIndicator=ONLINE; offlineSignature omitted; offline allocation disabled.'],
  ['SALES_REQUEST_DTOS.md', 'Versioned DTO via mapper — not ORM entities.'],
  ['SALES_PAYLOAD_VALIDATION.md', '`validateSalesPayloadV1` — size, required fields, no credentials.'],
  ['SALES_PAYLOAD_EVIDENCE.md', 'Stored on attempt.sanitizedRequestReference (JSON string); immutable checksums.'],
  ['EPHEMERAL_OVERLAY_EVIDENCE_POLICY.md', 'Base payload persisted; secrets only in-memory overlay (BAC blocked today).'],
  ['SALES_REQUEST_CANONICALIZATION.md', 'Phase 6 canonicalize once → transmitted bytes.'],
  ['X_EIS_MESSAGE_HASH.md', 'Mock: SHA-256 hex of exact bytes. Live: fail closed Q-010/Q-011.'],
  ['SALES_JWT_LEASING.md', '`withSecret` + SALES_TRANSMISSION_WORKER; mock synthetic JWT in memory only.'],
  ['SALES_REQUEST_HEADERS.md', 'Authorization Bearer, Content-Type, Accept, x-eis-message-hash.'],
  ['SALES_SUBMISSION_ATTEMPTS.md', 'Append-only MraEisTransmissionAttempt; unique attemptNumber.'],
  ['SALES_NETWORK_TRANSACTION_BOUNDARY.md', 'Prep TX → dispatch outside TX → result TX.'],
  ['SALES_HTTP_CLIENT.md', '`salesClient.js` — MOCK default; redirect:error; HTTPS for live.'],
  ['SALES_DISPATCH_EVIDENCE.md', 'SENDING → SENT_AWAITING_RESULT; timeout ≠ not-sent.'],
  ['SALES_RESPONSE_BYTE_HANDLING.md', 'Size limit, content-type, checksum, malformed JSON ≠ accepted.'],
  ['SALES_RESPONSE_EVIDENCE.md', 'Immutable MraEisResponse; sanitizedCanonicalResponse; qrDataPresent only.'],
  ['HTTP_STATUS_CLASSIFICATION.md', 'TRANSPORT_CLASS separate from APP_OUTCOME.'],
  ['MRA_APPLICATION_STATUS_CLASSIFICATION.md', 'Contract acceptedStatusValues; unrecognized → UNKNOWN fail closed.'],
  ['MRA_ACCEPTANCE_POLICY.md', 'Requires HTTP success + recognized accepted code + mraTransactionId.'],
  ['ACCEPTED_RESPONSE_PROCESSING.md', 'ACCEPTED_ONLINE + Phase 14 event; no QR/receipt; no resubmit.'],
  ['REJECTED_RESPONSE_PROCESSING.md', 'REJECTED retained; number retained; no accounting reversal; no auto-retry.'],
  ['DUPLICATE_RESPONSE_HANDLING.md', 'Duplicate → UNKNOWN/RECONCILE_BEFORE_RETRY — not assumed accepted.'],
  ['TEMPORARY_FAILURE_CLASSIFICATION.md', '429 → RETRY_SCHEDULED; 5xx/timeout after dispatch → UNKNOWN.'],
  ['AUTHENTICATION_FAILURE_HANDLING.md', '401/403 → MANUAL_REVIEW / credential remediation; JWT not logged.'],
  ['CONFIGURATION_REFRESH_SIGNAL.md', 'Idempotent CONFIGURATION_SYNC_REQUESTED outbox from attempt id.'],
  ['TERMINAL_BLOCK_SIGNAL.md', 'Terminal status BLOCKED; future claims fail readiness; tenant cannot override.'],
  ['SALES_UNKNOWN_OUTCOME.md', 'Preserves attempt + number; Phase 15 event; no blind retry.'],
  ['SALES_SAFE_RETRY_CLASSIFICATION.md', 'RETRY_CLASS enum; accepted/rejected/unknown not blindly retried.'],
  ['PHASE_14_ACCEPTED_EVENT.md', '`MRA_EIS_ACCEPTED_RECEIPT_REQUESTED` references only.'],
  ['PHASE_15_RECONCILIATION_EVENT.md', '`MRA_EIS_TRANSMISSION_RECONCILIATION_REQUESTED` references only.'],
  ['SALES_TRANSMISSION_WORKER.md', '`processSalesPayloadOutboxBatch` consumes Phase 12 sales-payload events.'],
  ['SALES_TRANSMISSION_CLAIMS.md', 'Claim via transmission status CLAIMED + worker id + expiry.'],
  ['SALES_TRANSMISSION_CONCURRENCY.md', 'Unique snapshot+mode; version increments; active-in-progress blocker.'],
  ['SALES_INTERNAL_FAILURE_RECOVERY.md', 'Reuse transmission/attempt by identity; never second fiscal number.'],
  ['PHASE_13_DATABASE_CONSTRAINTS.md', 'Phase 5 uniques: snapshot+mode, attemptNumber, attemptId on response.'],
  ['TRANSACTION_EIS_STATUS_PHASE_13.md', 'Receipt projection: SUBMITTING / RECEIPT_GENERATION_PENDING / REJECTED / UNKNOWN / TERMINAL_BLOCKED.'],
  ['SYSTEM_ADMIN_SALES_TRANSMISSION_UI.md', 'Tenant workspace; cross-tenant admin deferred.'],
  ['TENANT_SALES_TRANSMISSION_UI.md', '`/settings/integrations/mra-eis/sales-transmission` truthful statuses.'],
  ['PAYLOAD_INSPECTION_UI.md', 'Attempt sanitizedRequestReference checksums; no JWT.'],
  ['RESPONSE_INSPECTION_UI.md', 'Safe response fields; QR not rendered.'],
  ['MANUAL_SUBMISSION_POLICY.md', 'manual-submit requires reason; rejects client payload/JWT; blocks unknown retry.'],
  ['PHASE_13_APPROVALS.md', 'Production/live submit blocked; exceptional unlock requires verified contract + approval.'],
  ['PHASE_13_PERMISSIONS.md', 'eis.salesTransmission.* codes registered.'],
  ['PHASE_13_SEGREGATION_OF_DUTIES.md', 'Worker service identity; auditors read-only; no force-accept permission.'],
  ['PHASE_13_AUDIT_EVENTS.md', 'SALES_TRANSMISSION_ACCEPTED/REJECTED/OUTCOME via recordEisControlAudit.'],
  ['PHASE_13_NOTIFICATIONS.md', 'UI status messages; no credentials; distinguish local finalize vs MRA accept.'],
  ['PHASE_13_METRICS.md', 'Worker result counts; avoid high-cardinality labels.'],
  ['PHASE_13_ALERTS.md', 'Critical: duplicate accept, hash mismatch, credential leak, cross-tenant.'],
  ['PHASE_13_TYPED_ERRORS.md', '`SalesTransmissionErrors` stable codes.'],
  ['PHASE_13_SECURITY.md', 'Server-only; client fields rejected; JWT/BAC excluded from storage/logs.'],
  ['PHASE_13_RATE_LIMITING.md', 'Per-transmission active claim; manual retry of unknown blocked; mock rate scenarios.'],
  ['MOCK_MRA_SALES_SERVER.md', 'Scenarios: ACCEPT_*, REJECT_*, HTTP_*, TIMEOUT, DUPLICATE.'],
  ['PHASE_13_SANDBOX_SAFETY.md', 'Default MOCK; live sandbox blocked; no CI live Sales.'],
  ['LEGACY_SALES_TRANSMISSION_MIGRATION_PLAN.md', 'Disable submitInvoice; preserve historical EIS records read-only; no historical resubmit.'],
  ['LEGACY_SALES_TRANSMISSION_MIGRATION_REPORT.md', 'Legacy path returns 410 unless override flag. No historical Sales submitted by Phase 13.'],
  ['PHASE_13_SYNTHETIC_FIXTURES.md', 'Unit fixtures for mapping/hash/classifier/mock server.'],
  ['PHASE_13_TEST_PLAN.md', 'Vitest contract, mapper, hash, classifier, mock, permissions, legacy guard.'],
  ['PHASE_13_TEST_RESULTS.md', '`npx vitest run test/mraEis.phase13.salesTransmission.test.js` — 10/10 passed.'],
  ['PHASE_13_SECURITY_TEST_RESULTS.md', 'No BAC/JWT in mapped payload; client field rejection; live hash blocked.'],
  ['PHASE_13_END_TO_END_RESULTS.md', 'Path: Phase 12 outbox → process-outbox → mock accept → Phase 14 event. No QR/receipt/Journal.'],
  ['PHASE_13_SANDBOX_VERIFICATION_REPORT.md', 'Live sandbox not executed — contract blocked. Mock verification only.'],
  ['PHASE_13_DEPLOYMENT_PLAN.md', 'Deploy app; ensure MRA_EIS_USE_MOCK=1 for non-prod; do not set ALLOW_LEGACY_DIRECT_SALES; do not enable live Sales.'],
  ['PHASE_13_ROLLBACK_PLAN.md', 'Stop worker; leave ACCEPTED evidence; do not rewind numbers; revert app.'],
  ['PHASE_13_INCIDENT_RUNBOOKS.md', `| Incident | Action |\n|---|---|\n| Unknown outcome | Do not retry; open Phase 15 |\n| Auth failure | Remediate JWT; do not assume not processed |\n| Terminal block | Stop claims; notify admins |\n| Hash contract change | Do not invent algorithms |`],
  ['PHASE_13_RISK_REGISTER.md', 'Primary risk: unverified hash/success codes — mitigated by production block + fail closed.'],
];

for (const item of bulk) {
  files[item[0]] = short(item[0].replace(/\.md$/, '').replace(/_/g, ' '), item[1]);
}

files['PHASE_14_HANDOVER.md'] = short(
  'Phase 14 Handover',
  `## Phase 14 receives
- ACCEPTED_ONLINE transmission + accepted attempt + immutable response evidence
- responseChecksum, mraTransactionId, validationUrl, qrDataPresent (not rendered)
- Fiscal snapshot id/checksum/fiscal number + seller/buyer/lines/tax/payment snapshots
- Event \`MRA_EIS_ACCEPTED_RECEIPT_REQUESTED\` (references only)

## Phase 14 must
- Generate QR image + final fiscal receipt from immutable evidence
- Not call MRA Sales again
- Not mutate snapshot/number/accounting/inventory

## Phase 15 dependencies
- UNKNOWN_OUTCOME transmissions + reconciliation events
- Retry classifications
- Last Online/Offline interfaces (still blocked adapters)

## Known ambiguities
- QR payload structure (MRA clarification)
- Live success-code catalogue
- Message-hash algorithm`
);

files['PHASE_13_READINESS_DECISION.md'] = short(
  'Phase 13 Readiness Decision',
  `## Decision: READY_FOR_PHASE_14_WITH_BLOCKERS

| Area | Result |
|---|---|
| Endpoint contract | PROVISIONAL_SANDBOX_ONLY / live BLOCKED |
| Request hash | Mock OK / live BLOCKED |
| Mapper + validation + canonicalize | PASS |
| Classifier (HTTP≠accept) | PASS |
| Mock accept/reject/unknown paths | PASS |
| Phase 14/15 events | PASS |
| JWT security | PASS (server-only) |
| Legacy direct disable | PASS |
| Tests | 10/10 PASS |

### Remaining blockers
G13-001…G13-006 (hash, success codes, duplicates, production numbers, VAT5, live sandbox)

### Recommended next action
Implement Phase 14 QR/receipt from accepted evidence; keep live Sales gated.`
);

files['FINAL_PHASE_13_IMPLEMENTATION_REPORT.md'] = short(
  'Final Phase 13 Implementation Report',
  `## Executive summary
Phase 13 delivers contract-versioned Sales payload mapping, mock/provisional secure online transmission, immutable attempt/response evidence, acceptance/rejection/unknown classification, and Phase 14/15 outbox handoffs — without QR/receipt generation, without accounting/inventory mutation, and with production transmission correctly blocked.

## Confirmations
- Immutable snapshot is request source
- Bytes hashed = bytes sent (mock)
- JWT server-only; BAC not persisted
- HTTP 200 ≠ acceptance
- Accepted not resubmitted; unknown not blindly retried
- No Journal/Stock Movement; snapshot/number immutable
- No QR/receipt; no historical Sales

## Decision
\`READY_FOR_PHASE_14_WITH_BLOCKERS\`

## Honest conclusion
InsightBooks can submit mock/provisional Sales from immutable fiscal evidence with auditable outcomes. Live MRA Sales remain correctly blocked until message-hash and application-status contracts are verified.`
);

for (const [name, body] of Object.entries(files)) {
  w(name, body);
}

console.log(`Wrote ${Object.keys(files).length} Phase 13 docs to ${root}`);
