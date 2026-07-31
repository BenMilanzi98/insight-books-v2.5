const { doc, adr, written, D } = require('./_gen-phase3-pack.js');
const fs = require('fs');
const path = require('path');

doc('SALES_ELIGIBILITY_POLICY.md', 'Sales Eligibility Policy', [
  '`EisEligibilityResult evaluate(EisEligibilityInput)`',
  '',
  '## Include (candidates)',
  '',
  '- POS Sale status `completed` after accounting posted',
  '- Sales Invoice non-Draft / issued after accounting posted',
  '',
  '## Exclude',
  '',
  'Quotation, estimate, proforma, Draft, unapproved, cancelled/voided source, payments, purchases, expenses, transfers, journals, budgets, opening balances, inventory-only',
  '',
  'Corrections (void/credit/refund): eligibility only when Phase 1/MRA contract verified — otherwise MANUAL_REVIEW / blocked.',
  '',
  'Result carries blockers, terminal, site, config versions, mapping refs, policyVersion.',
]);

doc('CANONICAL_FISCALIZATION_EVENT.md', 'Canonical Fiscalization Event', [
  '## Decision',
  '',
  'Adapters emit **`EligibleSaleFinalized`** (alias of Phase 2 `SALE_FISCALIZATION_ELIGIBLE`) from:',
  '- `PosSaleFinalized` (completed POS)',
  '- `SalesInvoiceIssued` (non-Draft invoice after posting)',
  '',
  '```',
  'EligibleSaleFinalized {',
  '  eventId, eventVersion, sourceType, sourceId, sourceVersion,',
  '  tenantId, businessId, branchId?, transactionDate, postingDate,',
  '  currency, customerId?, localDocumentNumber, journalEntryId,',
  '  stockMovementIds[], total, taxTotal, paymentSummary,',
  '  finalizedBy, finalizedAt, correlationId',
  '}',
  '```',
  '',
  'No secrets, no MRA DTOs. Persisted via Outbox. Does not re-post accounting.',
]);

doc('ACCOUNTING_AND_EIS_TRANSACTION_BOUNDARY.md', 'Accounting and EIS Transaction Boundary', [
  '## Preferred local DB transaction',
  '',
  '1–8: validate + finalize sale/invoice + payments + stock + **Accounting V2 post**',
  '9: evaluate EIS eligibility',
  '10–11: create immutable snapshot (or create-marker) + Outbox `EIS_TRANSMISSION_QUEUED`',
  '12: audit',
  'COMMIT',
  '',
  '## After commit',
  '',
  'Worker: MRA network call · response classify · receipt projection update',
  '',
  '## Forbidden',
  '',
  'MRA HTTP inside financial transaction. Retry must not create second Sale/Journal/stock move.',
  '',
  '## Gap remediation if snapshot cannot join finalize tx',
  '',
  'Recovery scanner for SALE without snapshot; alert; bounded lag; still no network in financial tx.',
]);

doc('IMMUTABLE_FISCAL_SNAPSHOT_ARCHITECTURE.md', 'Immutable Fiscal Snapshot Architecture', [
  'Authoritative source for every transmission/retry.',
  '',
  'Contains identity, dates, seller, buyer (frozen), lines (mapped codes + amounts), payments, totals, compliance versions, checksum, journalEntryId.',
  '',
  'Rules: immutable once queued; no rebuild from mutable masters; no secrets; decimal-normalized amounts; checksum verified before send.',
]);

doc('SNAPSHOT_CREATION_STATE_MACHINE.md', 'Snapshot Creation State Machine', [
  'REQUESTED → VALIDATING → MAPPINGS_RESOLVED → NUMBER_RESERVED → CREATED → QUEUED · FAILED · SUPERSEDED · CANCELLED_BEFORE_QUEUE · MANUAL_REVIEW',
  '',
  'Failure reasons: missing terminal/site/mappings, invalid TIN/auth/VAT5, total mismatch, journal missing, business mismatch, period conflict, number allocation failure.',
]);

doc('FISCAL_NUMBERING_ARCHITECTURE.md', 'Fiscal Numbering Architecture', [
  '## Algorithm',
  '',
  'Per Phase 1 guide: Base64(TaxpayerID)-Base64(TerminalPosition)-Base64(JulianDate)-Base64(Count).',
  '',
  '**Implementation BLOCKED until official examples reproduce (Q-021).** Interface + fixtures prepared; no production allocator shipping wrong format.',
  '',
  '## Concurrency',
  '',
  '`MraEisFiscalSequence(terminalId, businessDate)` row lock (`FOR UPDATE`) → increment → unique constraint on fiscalNumber → attach to snapshot.',
  '',
  'No in-memory/cache-only counters. No reuse after allocation unless MRA explicitly allows (default: **never reuse**).',
  '',
  'Crash after allocate: number remains reserved to snapshot; do not reassign.',
]);

doc('TRANSMISSION_AGGREGATE_DESIGN.md', 'Transmission Aggregate Design', [
  'One transmission per snapshot; modes ONLINE | CERTIFIED_OFFLINE | TEST_SANDBOX.',
  '',
  'Statuses include CREATED→QUEUED→CLAIMED→SENDING→SENT_AWAITING_RESULT→ACCEPTED_ONLINE|REJECTED|RETRY_SCHEDULED|UNKNOWN_OUTCOME|RECONCILING|…|DEAD_LETTER|BLOCKED|…',
  '',
  'Invariants: ≤1 accepted per snapshot; unknown ⇒ reconcile before retry; blocked terminal cannot claim; checksum must match.',
]);

doc('TRANSMISSION_STATE_MACHINE.md', 'Transmission State Machine', [
  'Transitions for queue, claim, validate, send, accept, reject, retry schedule, unknown, reconcile, manual review, dead-letter, offline path, block, cancel-before-submit.',
  '',
  'Each transition: preconditions, lock, idempotency key, side effects, audit, metrics. Invalid transitions rejected.',
]);

doc('TRANSMISSION_ATTEMPT_ARCHITECTURE.md', 'Transmission Attempt Architecture', [
  'Append-only attempts: attemptNumber, requestChecksum, endpoint, timings, HTTP/MRA status, safe error, responseChecksum/ref, workerId, correlationId.',
  '',
  'No Authorization headers or secrets persisted.',
]);

doc('MRA_EIS_OUTBOX_ARCHITECTURE.md', 'MRA EIS Outbox Architecture', [
  'Events: EIS_SNAPSHOT_REQUESTED, EIS_TRANSMISSION_QUEUED, EIS_CONFIGURATION_REFRESH_REQUESTED, EIS_RECONCILIATION_REQUESTED, EIS_OFFLINE_UPLOAD_REQUESTED, EIS_RECEIPT_UPDATE_REQUESTED, EIS_ALERT_REQUESTED',
  '',
  'Atomic with business change; claim via `FOR UPDATE SKIP LOCKED` + lease; no secrets in payload.',
  '',
  '**Decision:** Prefer dedicated `MraEisOutbox` (or typed rows) with a **production dispatcher** — Phase 2 showed `AcctV2Outbox` writes without drain. May share claim infrastructure patterns with Accounting V2.',
]);

doc('QUEUE_AND_WORKER_TARGET_ARCHITECTURE.md', 'Queue and Worker Target Architecture', [
  'Workers: snapshot finalize (if needed), online transmit, reconcile, config sync, product sync, offline upload, receipt update, daily recon, token expiry, unblock poll, alerts, reports.',
  '',
  'Assume at-least-once; idempotent handlers; restore tenant+terminal context; bounded concurrency; tenant fairness; dead-letter; graceful shutdown.',
  '',
  'Deployment: durable DB-backed queue (not browser IndexedDB; not only Vercel cron). Cron may wake poller.',
]);

doc('PER_TERMINAL_ORDERING_ARCHITECTURE.md', 'Per Terminal Ordering Architecture', [
  'Ordered: fiscal number alloc (in tx), transmission claim/send, offline upload, config refresh, block/unblock.',
  '',
  'Partition key = terminalId. Cross-terminal parallel OK. No global tenant lock.',
]);

doc('EIS_IDEMPOTENCY_ARCHITECTURE.md', 'EIS Idempotency Architecture', [
  'Unique keys: entitlement version · activation attempt · config(type,version) · sync cursor · snapshot(sourceType,sourceId,sourceVersion,policyVersion) · fiscalNumber · transmission(snapshotId,mode) · attempt(transmissionId,n) · offline(snapshotId,sigVersion) · recon(run)',
  '',
  'SAME KEY + SAME PAYLOAD → return existing; SAME KEY + DIFFERENT PAYLOAD → conflict error.',
  '',
  'DB constraints mandatory; app checks insufficient.',
]);

doc('EIS_CONCURRENCY_ARCHITECTURE.md', 'EIS Concurrency Architecture', [
  'Protect: duplicate finalize, duplicate snapshot, sequence race, dual workers, config/mapping change mid-snapshot, block mid-send, pause mid-claim.',
  '',
  'Tools: unique constraints, row locks, optimistic version, status guards. Test each race.',
]);

doc('MRA_EIS_API_CLIENT_ARCHITECTURE.md', 'MRA EIS API Client Architecture', [
  '`MraEisClient` / `V1` + signer + parser + contract validator + endpoint registry.',
  '',
  'Server-only. Environment base URL. Deterministic serialization. Endpoint-specific auth/sign. Timeouts. Safe retry class. Redaction. Circuit breaker.',
  '',
  'Does not own eligibility, accounting, or total recalculation.',
]);

doc('CRYPTOGRAPHIC_BOUNDARY_ARCHITECTURE.md', 'Cryptographic Boundary Architecture', [
  '| Service | Status |',
  '|---|---|',
  '| ActivationConfirmationSigner (HMAC-SHA512 TAC) | Ready for KAT unit tests |',
  '| EisMessageHasher (x-eis-message-hash) | **BLOCKED** — interface only |',
  '| OfflineTransactionSigner | **BLOCKED** until KAT |',
  '| FiscalNumberEncoder | **BLOCKED** until examples reproduce |',
  '| PayloadCanonicalizer | Conditional on hash rules |',
  '',
  'No fake outputs for blocked algorithms.',
]);

doc('ONLINE_TRANSMISSION_ARCHITECTURE.md', 'Online Transmission Architecture', [
  'Claim → capability → terminal → config → checksum → creds → map DTO → validate → serialize → sign/hash(if verified) → send → attempt → classify → validationURL → config refresh / block flags → receipt event → audit/metrics.',
  '',
  '## POS UX default',
  '',
  '**Option B (default):** local receipt with `EIS_PENDING`; update when accepted. Option A (wait) configurable if MRA/tenant requires. Never show MRA Validated while pending.',
]);

doc('MRA_RESPONSE_CLASSIFICATION_ARCHITECTURE.md', 'MRA Response Classification Architecture', [
  'ACCEPTED · REJECTED_CORRECTABLE · REJECTED_PERMANENT · AUTHENTICATION_FAILURE · TERMINAL_BLOCKED · CONFIGURATION_REFRESH_REQUIRED · RATE_LIMITED · TEMPORARY_FAILURE · UNKNOWN_OUTCOME · INVALID_CONTRACT · MANUAL_REVIEW',
  '',
  'Not HTTP-alone. statusCode 0 vs 1 conflict → classifier table per endpoint after sandbox.',
]);

doc('UNKNOWN_OUTCOME_RECOVERY_ARCHITECTURE.md', 'Unknown Outcome Recovery Architecture', [
  'On timeout/reset/crash after dispatch: mark UNKNOWN_OUTCOME → reconcile via last-online (and get-invoice-by-number) → match fiscal# + terminal + TIN + site + date + totals + config versions (+ checksum) → ACCEPTED or safe retry same snapshot/number → else MANUAL_REVIEW.',
  '',
  'Never allocate new fiscal number solely because response lost.',
]);

doc('EIS_RETRY_ARCHITECTURE.md', 'EIS Retry Architecture', [
  'Automatic / Reconcile-before-retry / Data-correction / No-retry classes as in prompt.',
  '',
  'Bounded attempts + backoff + jitter + DLQ + manual retry permission. No unlimited retries.',
]);

doc('CIRCUIT_BREAKER_AND_BACKPRESSURE_ARCHITECTURE.md', 'Circuit Breaker and Backpressure Architecture', [
  'Per environment/endpoint CLOSED/OPEN/HALF_OPEN. Queue depth + oldest age limits. Open circuit: stop flooding; queue within limits; offline only if certified; alert; keep local accounting.',
]);

doc('CONFIGURATION_REFRESH_RESPONSE_ARCHITECTURE.md', 'Configuration Refresh Response Architecture', [
  'On shouldDownloadLatestConfig: persist response → classify current tx per verified semantics → mark stale → pause new sends → sync → remap → activate → resume. Do not guess acceptance of triggering sale.',
]);

doc('TERMINAL_BLOCKING_ARCHITECTURE.md', 'Terminal Blocking Architecture', [
  'On shouldBlockTerminal: persist → BLOCKED → stop claims → optional stop new snapshots → fetch message → critical audit/alert → no bypass via other terminal · offline only if MRA allows (default no) → poll unblock → config refresh → health check → resume.',
]);

doc('RECEIPT_AND_QR_LIFECYCLE_ARCHITECTURE.md', 'Receipt and QR Lifecycle Architecture', [
  'States: LOCAL_FINALIZED · EIS_NOT_REQUIRED · EIS_PENDING · EIS_FISCALIZING · EIS_ACCEPTED_ONLINE · EIS_SIGNED_OFFLINE · EIS_REJECTED · EIS_UNKNOWN_OUTCOME · EIS_BLOCKED · EIS_MANUAL_REVIEW',
  '',
  'Projection: local numbers, fiscal number, status, validationURL, QR checksum/asset, mode, terminal, TIN.',
  '',
  'QR content = MRA validation URL (or certified offline structure). Replace InsightBooks `/verify` for fiscal receipts once accepted. Pending/rejected never "MRA Validated". Reprints immutable.',
]);

doc('POS_INTEGRATION_BOUNDARY.md', 'POS Integration Boundary', [
  'After accounting in finalize tx → eligibility → snapshot+outbox. UI: Fiscalizing/Pending/Accepted/Rejected. No JWT/secret/TAC to browser. Duplicate-click: server idempotency key required (Phase 2 gap).',
]);

doc('SALES_INVOICE_INTEGRATION_BOUNDARY.md', 'Sales Invoice Integration Boundary', [
  'Fiscalize on non-Draft issue after posting — not on payment. PDF/email may send with EIS_PENDING then update. Material edit lock after snapshot. Payment after credit issue ≠ new EIS sale.',
]);

doc('B2B_TRANSACTION_ARCHITECTURE.md', 'B2B Transaction Architecture', [
  'Buyer TIN/name from customer at finalize → freeze in snapshot. Protected TIN → auth code challenge → validate via utility → evidence ref in snapshot; code masked, short retention, never logged/exported.',
]);

doc('VAT5_RELIEF_ARCHITECTURE.md', 'VAT5 Relief Architecture', [
  'Validate certificate before relief sale; quantity reservation/consumption with concurrency control; not ordinary zero-rate. Overuse blocked. Corrections pending MRA guidance.',
]);

doc('CERTIFIED_OFFLINE_ARCHITECTURE_BLUEPRINT.md', 'Certified Offline Architecture Blueprint', [
  '## Selected classification',
  '',
  '**OFFLINE_NOT_CURRENTLY_FEASIBLE** for browser SaaS secret custody; optional future **DESKTOP_POS_AGENT / LOCAL_BRANCH_SERVICE** after MRA cert + KAT.',
  '',
  'Default: online-only until certification. Do not put secretKey in browser IndexedDB (`offlineSalesQueue` ≠ MRA offline).',
]);

doc('OFFLINE_QUEUE_AGGREGATE.md', 'Offline Queue Aggregate', [
  'Fields/statuses as prompt. Implementation gated on CERTIFIED_OFFLINE + crypto KAT + secure local runtime. Thresholds from terminalConfiguration.offlineLimit; zero meaning RC (do not treat as unlimited).',
]);

console.log('p3-part2', written.length);
fs.writeFileSync(path.join(__dirname, '_written.json'), JSON.stringify(written, null, 2));
module.exports = { doc, adr, written, D };
