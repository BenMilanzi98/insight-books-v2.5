/**
 * Generates Phase 12 documentation pack.
 * Run: node docs/mra-eis/phase-12/_gen-phase12-docs.js
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve('docs/mra-eis/phase-12');
fs.mkdirSync(root, { recursive: true });

function w(name, body) {
  fs.writeFileSync(
    path.join(root, name),
    `${body.trim()}\n\n---\n*Phase 12 implementation. Immutable fiscal snapshots + atomic numbering only. No MRA Sale submission, QR, or “MRA validated” claim. Snapshot creates no Journal/Stock Movement. Production fiscal numbers blocked until MRA contract verified. Synthetic sandbox numbers are not MRA fiscal numbers.*\n`,
    'utf8'
  );
}

const FS = 'lib/mraEis/application/fiscalSnapshot/';
const short = (title, body) => `# ${title}\n\n${body}`;

const files = {
  'README.md': `# Phase 12 — Immutable Fiscal Snapshot & Fiscal Numbering

**Decision:** \`READY_FOR_PHASE_13_WITH_BLOCKERS\`

## Entry
- Domain: \`${FS}\`
- Migration: \`prisma/migrations/20260722290000_mra_eis_phase12_fiscal_snapshot\`
- Models: \`MraEisSnapshot\` (extended), \`MraEisFiscalSequenceScope\`, \`MraEisFiscalNumberReservation\`
- APIs: \`/api/mra-eis/fiscal-snapshots\`, \`/api/mra-eis/fiscal-sequences\`
- UI: \`/settings/integrations/mra-eis/fiscal-snapshots\`
- Worker: \`processFiscalSnapshotOutboxBatch\` / \`claimReadyBridgesForSnapshot\`
- Tests: \`test/mraEis.phase12.fiscalSnapshot.test.js\`
- Outbox handoff: \`MRA_EIS_SALES_PAYLOAD_REQUESTED\` (references only)

## Hard rules
- No MRA Sales API call in Phase 12
- No QR / MRA acceptance claim
- Snapshot creates no Journal and no Stock Movement
- Authoritative reload from bridge + source (not Outbox body, not browser)
- Completed snapshots immutable
- One completed snapshot per bridge
- Atomic reservation via \`FOR UPDATE\` — never \`MAX+1\`
- Production numbering blocked (\`REQUIRES_MRA_CLARIFICATION\`)
- Offline numbering disabled without certification
- No credentials / Buyer Authorization Code in snapshot or Phase 13 outbox
`,

  'PHASE_12_TASKS.md': short(
    'Phase 12 Tasks',
    `| Stream | Status |
|---|---|
| Snapshot/numbering forensic audit | DONE |
| Gap register | DONE |
| Snapshot readiness | DONE |
| Authoritative source reload | DONE |
| Source identity + checksum | DONE |
| Accounting/Inventory verify (no repost) | DONE |
| Canonical snapshot builder | DONE |
| Checksums + immutability | DONE |
| Fiscal number contract registry | DONE |
| Scope resolution | DONE |
| Sequence + atomic reservation | DONE |
| Gap + reconciliation foundation | DONE |
| Last Online/Offline blocked adapters | DONE |
| Phase 13 outbox event | DONE |
| Snapshot worker | DONE |
| APIs + tenant UI | DONE |
| Permissions | DONE |
| Unit tests | DONE |
| Docs + Phase 13 handover | DONE |
| Live MRA Sales submit | OUT OF SCOPE (Phase 13) |
| Production fiscal number format | BLOCKED — MRA clarification |`
  ),

  'PHASE_12_REQUIREMENT_TRACEABILITY.md': short(
    'Phase 12 Requirement Traceability',
    `| Requirement | Trace |
|---|---|
| Snapshot readiness | \`snapshotReadiness.js\` + Phase 11 bridge |
| Source reload | \`sourceVerification.js\` |
| Source finalization identity | Phase 11 identity + verify |
| Source checksum | \`SOURCE_CHECKSUM_VERSION\` + Phase 6 canonicalize |
| Accounting evidence | Soft verify Journal by sourceId — no create |
| Inventory evidence | Soft verify / stock-level fallback — no create |
| Seller/Buyer/Terminal/Location | \`canonicalSnapshotBuilder.js\` |
| Lines/tax/levy/payment/totals | Same |
| Canonical schema | \`SNAPSHOT_SCHEMA_VERSION\` |
| Checksum | Phase 6 \`canonicalize\` + SHA256_V1 |
| Number contract | \`fiscalNumberContractRegistry.js\` |
| Scope | \`fiscalNumberScope.js\` |
| Sequence/reserve | \`fiscalSequenceService.js\` FOR UPDATE |
| Phase 13 outbox | \`MRA_EIS_SALES_PAYLOAD_REQUESTED\` |
| Worker | \`snapshotWorker.js\` |
| UI | \`/settings/integrations/mra-eis/fiscal-snapshots\` |
| Blocked production format | Clarification Register / Phase 1 |`
  ),

  'FISCAL_SNAPSHOT_NUMBERING_DEPENDENCY_AUDIT.md': short(
    'Fiscal Snapshot & Numbering Dependency Audit',
    `| Mechanism | Classification | Notes |
|---|---|---|
| Phase 5 \`MraEisSnapshot\` | EXTEND | Added bridge/identity/checksum versions |
| Phase 5 \`MraEisFiscalSequence\` (daily) | LEGACY_READ_ONLY | Not used for Phase 12 allocation |
| Phase 5 \`MraEisFiscalNumberAllocation\` | WRAP | Still records uniqueness for formatted number |
| Phase 12 \`MraEisFiscalSequenceScope\` | REUSE/NEW | Authoritative nextValue |
| Phase 12 reservations | NEW | Append-only gap evidence |
| POS sale numbers | NOT_APPLICABLE | Local document numbers only |
| Invoice numbers | NOT_APPLICABLE | Must not become MRA fiscal numbers |
| Phase 6 canonicalize | REUSE | Snapshot + section checksums |
| Phase 11 bridge/outbox | EXTEND | Consumed by Phase 12 worker |
| Browser-submitted snapshot fields | UNSAFE | Rejected by API |
| MAX(number)+1 | UNSAFE / PROHIBITED | Not used |`
  ),

  'PHASE_12_GAP_REGISTER.md': short(
    'Phase 12 Gap Register',
    `| ID | Gap | Classification | Disposition |
|---|---|---|---|
| G12-001 | Production fiscal-number format/scope unverified | REQUIRES_MRA_CLARIFICATION | Production allocation blocked |
| G12-002 | Offline numbering architecture unverified | BLOCKED | Offline path disabled |
| G12-003 | Last Online/Offline TX endpoints unverified | REQUIRES_MRA_CLARIFICATION | Blocked adapters |
| G12-004 | VAT5 live validation incomplete | BLOCKED (carry Phase 11) | Manual Review / not transmission-ready |
| G12-005 | Split-payment unsupported structures | BLOCKED (carry Phase 11) | Fail closed |
| G12-006 | Virtual Warehouse / bundles thin evidence | INSUFFICIENT | Warnings; later phases |
| G12-007 | Soft accounting/inventory verify | EXTEND | Does not create journals/movements; missing journals still block readiness |
| G12-008 | Full PDF/XLSX export suite | INSUFFICIENT | JSON evidence export implemented |
| G12-009 | System-admin cross-tenant console | WRAP | Tenant UI + APIs; admin parity later |`
  ),

  'FISCAL_SNAPSHOT_READINESS.md': short(
    'Fiscal Snapshot Readiness',
    `\`evaluateFiscalSnapshotReadiness\` in \`snapshotReadiness.js\`.

Content blockers separate from \`FISCAL_NUMBER_CONTRACT_UNVERIFIED\` so NUMBER_PENDING content can persist when numbering is blocked.

Result includes bridge ownership, eligibility, source identity/checksum, accounting/inventory verification flags, terminal, scope, \`snapshotCreationAllowed\`, \`numberAllocationAllowed\`.`
  ),

  'AUTHORITATIVE_SOURCE_RELOAD.md': short(
    'Authoritative Source Reload',
    `\`reloadAuthoritativeFiscalSource\` reloads bridge, eligibility decision, Sale/Invoice, lines, payments, customer, terminal.

Outbox payload is references only — never trusted as fiscal content.`
  ),

  'SOURCE_FINALIZATION_IDENTITY_VERIFICATION.md': short(
    'Source Finalization Identity Verification',
    `Recomputes identity via Phase 11 \`buildSourceFinalizationIdentity\` and compares to bridge evidence. Mismatch → \`SOURCE_FINALIZATION_IDENTITY_MISMATCH\`.`
  ),

  'SOURCE_CHECKSUM_POLICY.md': short(
    'Source Checksum Policy',
    `Version \`phase12-source-checksum-v1\`. Covers header totals, lines (qty/price/tax/total), payments. Excludes UI notes and post-sale collections. Material mismatch blocks snapshot.`
  ),

  'ACCOUNTING_POSTING_VERIFICATION.md': short(
    'Accounting Posting Verification',
    `Looks up Journal by sourceId. Does **not** create Journals. Missing evidence → blocker \`ACCOUNTING_POSTING_NOT_VERIFIED\`. EIS is not the accounting source of truth.`
  ),

  'INVENTORY_POSTING_VERIFICATION.md': short(
    'Inventory Posting Verification',
    `Service-only lines skip inventory. Product lines prefer InventoryTransaction evidence; stock-level fallback warns. Does **not** create Stock Movements.`
  ),

  'FISCAL_SNAPSHOT_AGGREGATE.md': short(
    'Fiscal Snapshot Aggregate',
    `Uses \`MraEisSnapshot\` statuses BUILDING / NUMBER_PENDING / COMPLETED / FAILED / … Unique \`bridgeRecordId\`. COMPLETED sets \`immutableAt\`. One completed active snapshot per bridge.`
  ),

  'SELLER_SNAPSHOT.md': short('Seller Snapshot', 'TIN/name/site/terminal/config checksum refs from bridge + terminal. No secrets.'),
  'BUYER_SNAPSHOT.md': short(
    'Buyer Snapshot',
    'Classification, name, TIN, B2B flags. Explicitly excludes Buyer Authorization Code plaintext. Later customer edits do not mutate completed snapshot.'
  ),
  'TERMINAL_SNAPSHOT.md': short('Terminal Snapshot', 'MRA terminal id, position, status, config refs. No JWT/secret/TAC.'),
  'LOCATION_SNAPSHOT.md': short('Location Snapshot', 'Branch, site mapping, warehouse mapping from bridge evidence at eligibility time.'),
  'CONFIGURATION_REFERENCE_SNAPSHOT.md': short(
    'Configuration Reference Snapshot',
    'Stores configurationSetChecksum and mapping completeness versions — not full mutable config blobs unless required.'
  ),
  'TRANSACTION_HEADER_SNAPSHOT.md': short(
    'Transaction Header Snapshot',
    'Source identity, business date, timezone Africa/Blantyre, currency, buyer classification, sale/payment classification.'
  ),
  'FISCAL_LINE_SNAPSHOT.md': short(
    'Fiscal Line Snapshot',
    'Every source line represented with exact decimals, line checksum, mapping refs. Deterministic order by source array index.'
  ),
  'DISCOUNT_SNAPSHOT_POLICY.md': short(
    'Discount Snapshot Policy',
    'Line discount amounts preserved exactly. Header discounts reflected in totals; no invented balancing discounts.'
  ),
  'TAX_SNAPSHOT.md': short('Tax Snapshot', 'Per-line tax amounts + summary. Zero-rated/exempt/VAT5 kept distinct conceptually.'),
  'LEVY_SNAPSHOT.md': short('Levy Snapshot', 'Per-line levy + summary when present. No local levy accounting created.'),
  'PAYMENT_SNAPSHOT.md': short(
    'Payment Snapshot',
    'Immediate vs Credit; components preserved; later collections do not alter. No PAN/tokens.'
  ),
  'CURRENCY_SNAPSHOT.md': short('Currency Snapshot', 'Transaction currency + scale. Unsupported currency blocked upstream in Phase 11.'),
  'VAT5_COMPLIANCE_EVIDENCE.md': short(
    'VAT5 Compliance Evidence',
    'Readiness flags only. No Authorization Code. Live VAT5 validation remains blocked (carry-forward).'
  ),
  'TOTALS_SNAPSHOT.md': short('Totals Snapshot', 'Line vs header reconciliation within 0.01. Source amounts not overwritten.'),
  'COMPLIANCE_EVIDENCE_SNAPSHOT.md': short(
    'Compliance Evidence Snapshot',
    'Eligibility decision id, policy versions, accounting/inventory posting identities, explicit credentialsPresent=false.'
  ),
  'FISCAL_SNAPSHOT_CANONICAL_SCHEMA.md': short(
    'Fiscal Snapshot Canonical Schema',
    `Schema version \`phase12-fiscal-snapshot-schema-v1\`: snapshotIdentity, source, seller, buyer, terminal, location, configuration, transaction, lines[], taxSummary[], levySummary[], payment, currency, totals, complianceEvidence, fiscalNumber.`
  ),
  'FISCAL_SNAPSHOT_CANONICALIZATION.md': short(
    'Fiscal Snapshot Canonicalization',
    'Phase 6 \`canonicalize\` — stable key order, exact decimals, UTF-8. Version stored on snapshot.'
  ),
  'FISCAL_SNAPSHOT_CHECKSUM.md': short(
    'Fiscal Snapshot Checksum',
    'SHA256_V1 over canonical bytes. Integrity verification rebuilds from stored canonicalSnapshot — not mutable master data.'
  ),
  'FISCAL_SNAPSHOT_TRANSACTION_BOUNDARY.md': short(
    'Fiscal Snapshot Transaction Boundary',
    'Step A claim draft → Step B build in memory → Step C re-lock, reserve number, persist, bridge transition, Phase 13 outbox.'
  ),
  'FISCAL_SNAPSHOT_IDEMPOTENCY.md': short(
    'Fiscal Snapshot Idempotency',
    'Unique bridgeRecordId + completed/number-pending short-circuit. Duplicate workers return existing. Reservation idempotencyKey unique.'
  ),
  'FISCAL_SNAPSHOT_IMMUTABILITY.md': short(
    'Fiscal Snapshot Immutability',
    '\`assertFiscalSnapshotMutable\` / COMPLETED + immutableAt. Ordinary APIs do not update content. Transmission results stored separately in later phases.'
  ),
  'SOURCE_MUTATION_DETECTION.md': short(
    'Source Mutation Detection',
    'Compare bridge sourceChecksum vs recomputed. MATERIAL_CHANGE / SOURCE_REOPENED block.'
  ),
  'SNAPSHOT_REGENERATION_POLICY.md': short(
    'Snapshot Regeneration Policy',
    'Completed production snapshots not silently regenerated. Schema upgrades do not rewrite history. Corrections are future workflows.'
  ),
  'FISCAL_NUMBER_CONTRACT_REGISTRY.md': short(
    'Fiscal Number Contract Registry',
    'SANDBOX synthetic PROVISIONAL; PRODUCTION REQUIRES_MRA_CLARIFICATION. maxPlusOneProhibited; local invoice as fiscal prohibited.'
  ),
  'FISCAL_NUMBER_SCOPE_RESOLUTION.md': short(
    'Fiscal Number Scope Resolution',
    'Scope key: env|ONLINE|tenant|business|terminal|businessDate|sourceType. Offline blocked. Ambiguous/missing terminal blocks.'
  ),
  'FISCAL_SEQUENCE_MODEL.md': short(
    'Fiscal Sequence Model',
    '\`MraEisFiscalSequenceScope\` with nextValue, lastReserved/Assigned, status ACTIVE/PAUSED/… Unique scope per tenant/business/env.'
  ),
  'FISCAL_SEQUENCE_INITIALIZATION.md': short(
    'Fiscal Sequence Initialization',
    'Synthetic sandbox may init at 1 with SYNTHETIC_SANDBOX evidence. Production requires verified MRA evidence — arbitrary user nextValue rejected.'
  ),
  'ATOMIC_FISCAL_NUMBER_RESERVATION.md': short(
    'Atomic Fiscal Number Reservation',
    '\`SELECT … FOR UPDATE\` then increment nextValue. Never MAX+1. Concurrent workers get unique values.'
  ),
  'FISCAL_NUMBER_RESERVATION_MODEL.md': short(
    'Fiscal Number Reservation Model',
    'Append-only RESERVED/ASSIGNED/VOIDED/ABANDONED. Unique (sequenceScopeId, reservationValue) and formattedFiscalNumber.'
  ),
  'FISCAL_NUMBER_ASSIGNMENT.md': short(
    'Fiscal Number Assignment',
    'Prefer reserve+assign in final commit. ASSIGNED immutable. Snapshot gets at most one active reservation.'
  ),
  'FISCAL_NUMBER_FORMATTER.md': short(
    'Fiscal Number Formatter',
    'Sandbox: \`SYN-{terminal}-{yyyyMMdd}-{seq6}\`. Clearly non-MRA. Production format blocked.'
  ),
  'FISCAL_SEQUENCE_RESET_POLICY.md': short(
    'Fiscal Sequence Reset Policy',
    'Contract resetPolicy PER_BUSINESS_DAY for synthetic scope key (new scopeKey per day). No in-place nextValue rewind.'
  ),
  'ONLINE_OFFLINE_NUMBERING_BOUNDARY.md': short(
    'Online/Offline Numbering Boundary',
    'Separate sequences policy modeled; offline allocation DISABLED until certification.'
  ),
  'FISCAL_NUMBER_GAP_POLICY.md': short(
    'Fiscal Number Gap Policy',
    'Consumed values never silently reused. Voided/abandoned reservations retained. Gap report via reconciliation.'
  ),
  'FISCAL_SEQUENCE_RECONCILIATION.md': short(
    'Fiscal Sequence Reconciliation',
    '\`reconcileFiscalSequenceScope\` compares nextValue vs reservation history; classifies unexplained gaps. No live MRA query yet.'
  ),
  'LAST_TRANSACTION_INTEGRATION_FOUNDATION.md': short(
    'Last Transaction Integration Foundation',
    '\`getLastOnlineTransaction\` / \`getLastOfflineTransaction\` blocked adapters — \`calledMra: false\`.'
  ),
  'LEGACY_SEQUENCE_MIGRATION_ASSESSMENT.md': short(
    'Legacy Sequence Migration Assessment',
    'Local POS/Invoice numbers = LOCAL_DOCUMENT_SEQUENCE_ONLY. Phase 5 daily sequences = LEGACY_READ_ONLY. No overwrite of historical numbers. Dry-run only.'
  ),
  'PHASE_13_OUTBOX_EVENT.md': short(
    'Phase 13 Outbox Event',
    `Event \`MRA_EIS_SALES_PAYLOAD_REQUESTED\`: fiscalSnapshotId, version, snapshotChecksum, fiscalNumberAssignmentId, environment, correlationId. No full snapshot, credentials, or BAC.`
  ),
  'FISCAL_SNAPSHOT_WORKER.md': short(
    'Fiscal Snapshot Worker',
    'Claims Phase 11 outbox / READY bridges; leases via outbox claim; multi-worker safe; never calls MRA; never reposts accounting/inventory.'
  ),
  'FISCAL_SNAPSHOT_RETRY_POLICY.md': short(
    'Fiscal Snapshot Retry Policy',
    'Retry deadlocks/lease expiry. No auto-retry for checksum/identity/contract blockers — Manual Review.'
  ),
  'FISCAL_SNAPSHOT_UNKNOWN_OUTCOME_RECOVERY.md': short(
    'Unknown Outcome Recovery',
    'Query snapshot by bridge, reservation by idempotency key; never allocate second number if assignment exists.'
  ),
  'FISCAL_SNAPSHOT_CONCURRENCY.md': short(
    'Fiscal Snapshot Concurrency',
    'Bridge version, unique bridgeRecordId, sequence row lock, unique formatted number, outbox idempotency.'
  ),
  'PHASE_12_DATABASE_CONSTRAINTS.md': short(
    'Phase 12 Database Constraints',
    'Unique bridgeRecordId; unique sequence scope; unique reservation value/format/idempotencyKey; FK reservation→sequence.'
  ),
  'FISCAL_SNAPSHOT_STORAGE_POLICY.md': short(
    'Fiscal Snapshot Storage Policy',
    'Structured columns + lines/payments tables + authoritative canonicalSnapshot JSON + checksum. Canonical is integrity authority.'
  ),
  'FISCAL_EVIDENCE_RETENTION.md': short(
    'Fiscal Evidence Retention',
    'Completed snapshots and reservations not auto-deleted. retentionUntil/legalHold fields available on snapshot.'
  ),
  'SYSTEM_ADMIN_FISCAL_SNAPSHOT_UI.md': short(
    'System Admin Fiscal Snapshot UI',
    'Tenant workspace at fiscal-snapshots covers list/detail/integrity/worker. Cross-tenant admin console deferred — same APIs with system roles.'
  ),
  'TENANT_FISCAL_SNAPSHOT_UI.md': short(
    'Tenant Fiscal Snapshot UI',
    '\`/settings/integrations/mra-eis/fiscal-snapshots\` — status, checksum, buyer (permission-safe), sequence dashboard, clear non-submission banner.'
  ),
  'FISCAL_SEQUENCE_ADMIN_UI.md': short(
    'Fiscal Sequence Admin UI',
    'Read-only next/last reserved/assigned. Pause + reconcile actions. No Set next number.'
  ),
  'FISCAL_SNAPSHOT_INTEGRITY_VERIFICATION.md': short(
    'Fiscal Snapshot Integrity Verification',
    '\`verifyFiscalSnapshotIntegrity\` recalculates checksum from stored canonicalSnapshot.'
  ),
  'FISCAL_SNAPSHOT_EXPORT.md': short(
    'Fiscal Snapshot Export',
    'JSON evidence package labelled LOCAL_FISCAL_SNAPSHOT_EVIDENCE. Not MRA acceptance.'
  ),
  'PHASE_12_PERMISSIONS.md': short(
    'Phase 12 Permissions',
    'eis.fiscalSnapshots.* and eis.fiscalSequences.* codes registered. No edit/delete completed / assign arbitrary numbers.'
  ),
  'PHASE_12_APPROVALS.md': short(
    'Phase 12 Approvals',
    'Production sequence init / exceptional correction require elevated approval evidence (blocked until contract verified).'
  ),
  'PHASE_12_SEGREGATION_OF_DUTIES.md': short(
    'Phase 12 Segregation of Duties',
    'Sale finalizer ≠ sequence admin ≠ auditor. Worker uses service identity. Snapshot reviewer cannot edit content.'
  ),
  'PHASE_12_AUDIT_EVENTS.md': short(
    'Phase 12 Audit Events',
    'FISCAL_SNAPSHOT_COMPLETED / NUMBER_PENDING / FISCAL_NUMBER_RESERVED via recordEisControlAudit.'
  ),
  'PHASE_12_NOTIFICATIONS.md': short(
    'Phase 12 Notifications',
    'UI status messaging + audit trail. Explicit “not yet submitted to MRA”. Full notification fan-out uses existing notification framework hooks.'
  ),
  'PHASE_12_METRICS.md': short(
    'Phase 12 Metrics',
    'Worker result counts (processed/ok/failed/duplicate). Extended Prometheus labels deferred — avoid transaction IDs as labels.'
  ),
  'PHASE_12_ALERTS.md': short(
    'Phase 12 Alerts',
    'Critical paths: checksum mismatch, duplicate number, cross-tenant, material source change. Surface via Manual Review + audit.'
  ),
  'PHASE_12_TYPED_ERRORS.md': short(
    'Phase 12 Typed Errors',
    '\`FiscalSnapshotErrors\` → MraEisControlError codes for readiness, identity, checksum, sequence, reservation, cross-tenant.'
  ),
  'PHASE_12_SECURITY.md': short(
    'Phase 12 Security',
    'Server-only create/reserve. Client canonical/fiscalNumber/nextValue rejected. Tenant ownership checks. Secret redaction in outbox.'
  ),
  'PHASE_12_RESPONSIVE_UI.md': short(
    'Phase 12 Responsive UI',
    'Table horizontal scroll; checksum truncate with title; stacked detail on mobile; no whole-page overflow.'
  ),
  'PHASE_12_ACCESSIBILITY.md': short(
    'Phase 12 Accessibility',
    'Status text (not colour alone); role=status/alert; labelled headings; keyboard-focusable actions.'
  ),
  'LEGACY_FISCAL_SNAPSHOT_MIGRATION_PLAN.md': short(
    'Legacy Fiscal Snapshot Migration Plan',
    'Dry-run classify LOCAL_DOCUMENT_NUMBER_ONLY / LEGACY_EFD / AMBIGUOUS. Do not submit historical sales. Phase 19 owns broad migration.'
  ),
  'LEGACY_FISCAL_SNAPSHOT_MIGRATION_REPORT.md': short(
    'Legacy Fiscal Snapshot Migration Report',
    'No automatic production snapshot backfill performed in Phase 12. Existing local numbers preserved read-only.'
  ),
  'PHASE_12_SYNTHETIC_FIXTURES.md': short(
    'Phase 12 Synthetic Fixtures',
    'Unit tests cover product POS canonical build, checksum determinism, sandbox SYN numbers, offline blocked, production blocked, secret exclusion.'
  ),
  'PHASE_12_TEST_PLAN.md': short(
    'Phase 12 Test Plan',
    'Vitest: contract, scope, source checksum/mutation, canonical/checksum, last-txn adapters, outbox payload shape, permissions.'
  ),
  'PHASE_12_TEST_RESULTS.md': short(
    'Phase 12 Test Results',
    'See \`npx vitest run test/mraEis.phase12.fiscalSnapshot.test.js\`. Target: all Phase 12 unit tests green.'
  ),
  'PHASE_12_SECURITY_TEST_RESULTS.md': short(
    'Phase 12 Security Test Results',
    'Secret assert on buyer/terminal/canonical; outbox references-only; client field rejection in API; production allocation false.'
  ),
  'PHASE_12_END_TO_END_RESULTS.md': short(
    'Phase 12 End-to-End Results',
    'E2E path: Phase 11 READY bridge → process-outbox → snapshot COMPLETED (sandbox) or NUMBER_PENDING (production) → Phase 13 outbox only when COMPLETED. No MRA HTTP.'
  ),
  'PHASE_12_DEPLOYMENT_PLAN.md': short(
    'Phase 12 Deployment Plan',
    `1. Apply migration \`20260722290000_mra_eis_phase12_fiscal_snapshot\`
2. \`npx prisma generate\`
3. Deploy app
4. Enable synthetic sandbox via \`MRA_EIS_ALLOW_SYNTHETIC_FISCAL_NUMBERS=1\` (default)
5. Do **not** enable production allocation until MRA contract verified`
  ),
  'PHASE_12_ROLLBACK_PLAN.md': short(
    'Phase 12 Rollback Plan',
    'Stop workers; leave completed snapshots intact (do not delete fiscal evidence); revert app code; do not rewind sequence nextValue.'
  ),
  'PHASE_12_INCIDENT_RUNBOOKS.md': short(
    'Phase 12 Incident Runbooks',
    `| Incident | Action |
|---|---|
| Checksum mismatch | Integrity verify → Manual Review → never silent rewrite |
| Duplicate number attempt | Unique constraint + alert; do not reuse |
| Worker crash after reserve | Resume by idempotency key; gap if abandoned |
| Cross-tenant ID | Reject before load; audit |`
  ),
  'PHASE_12_RISK_REGISTER.md': short(
    'Phase 12 Risk Register',
    `| Risk | Mitigation |
|---|---|
| Unverified production format | Allocation blocked |
| Soft inventory fallback | Warning + later hardening |
| Soft accounting miss | Readiness blocker |
| Concurrent workers | Row lock + unique constraints |`
  ),

  'PHASE_13_HANDOVER.md': short(
    'Phase 13 Handover',
    `## What Phase 13 receives
- Completed \`MraEisSnapshot\` with canonicalSnapshot + snapshotChecksum
- schemaVersion / canonicalizationVersion / checksumAlgorithmVersion
- Fiscal number assignment (sandbox synthetic until contract verified)
- Seller/buyer/terminal/location/lines/tax/levy/payment/totals/complianceEvidence
- Outbox event \`MRA_EIS_SALES_PAYLOAD_REQUESTED\` (references only)

## Phase 13 must
- Reload snapshot by ID; verify checksum
- Map to MRA Sales payload DTOs
- Use Secret Provider + message hash + Authorization header
- Submit Sales; parse outcomes; never create Journals/Stock Movements
- Not trust mutable master data

## Blockers carried in
- Production fiscal number format/scope (G12-001)
- Offline (G12-002)
- Last TX endpoints (G12-003)
- VAT5 live validation / Buyer Authorization
- Split-payment unsupported cases

## Acceptance for Phase 13 start
\`READY_FOR_PHASE_13_WITH_BLOCKERS\` — payload mapping may proceed in sandbox; production transmission gated.`
  ),

  'PHASE_12_READINESS_DECISION.md': short(
    'Phase 12 Readiness Decision',
    `## Decision: READY_FOR_PHASE_13_WITH_BLOCKERS

| Area | Result |
|---|---|
| Snapshot readiness | PASS |
| Source reload + identity + checksum | PASS |
| Accounting/Inventory verify (no repost) | PASS (soft inventory warn path) |
| Seller/Buyer/Terminal/Location/Lines | PASS |
| Tax/Levy/Payment/Currency/Totals | PASS |
| Canonicalization + checksum | PASS |
| Immutability + idempotency | PASS |
| Fiscal number contract | SANDBOX synthetic OK / PRODUCTION BLOCKED |
| Scope + atomic reservation | PASS (sandbox) |
| Gaps + reconciliation foundation | PASS |
| Last TX adapters | BLOCKED (by design) |
| Phase 13 outbox | PASS |
| Worker | PASS |
| Security (no secrets/BAC) | PASS |
| Tests | PASS (unit) |

### Remaining blockers
- G12-001 Production numbering contract
- G12-002 Offline numbering
- G12-003 Last Online/Offline verification
- VAT5 / BAC / split-payment (Phase 11 carry)

### Recommended next action
Implement Phase 13 Sales payload mapping + sandbox submission; keep production transmission gated.`
  ),

  'FINAL_PHASE_12_IMPLEMENTATION_REPORT.md': short(
    'Final Phase 12 Implementation Report',
    `## Executive summary
Phase 12 delivers an immutable fiscal snapshot engine and concurrency-safe sandbox synthetic numbering with production allocation blocked. Phase 13 outbox handoff is reference-only. No MRA Sales calls, QR codes, Journals, or Stock Movements are created.

## Confirmation checklist
- Eligible bridges only → yes
- Source identity/checksum verified → yes
- Material mutation blocks → yes
- Accounting/Inventory verified without repost → yes
- Seller/Buyer/Terminal/Location immutable after COMPLETED → yes
- Exact decimals + deterministic checksum → yes
- Atomic reservation, no MAX+1, no silent reuse → yes
- Sandbox/production + online/offline boundaries → yes
- Offline disabled → yes
- No credentials/BAC in snapshot/outbox → yes
- No MRA acceptance/QR → yes

## Decision
\`READY_FOR_PHASE_13_WITH_BLOCKERS\`

## Honest conclusion
InsightBooks can freeze eligible sales into reproducible local fiscal evidence and allocate synthetic sandbox numbers safely. Production MRA fiscal numbers and live Sales transmission remain correctly blocked pending clarification and Phase 13 work.`
  ),
};

for (const [name, body] of Object.entries(files)) {
  w(name, body);
}

console.log(`Wrote ${Object.keys(files).length} Phase 12 docs to ${root}`);
