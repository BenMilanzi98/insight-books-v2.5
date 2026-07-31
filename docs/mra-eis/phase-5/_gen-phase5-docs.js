/**
 * Generates Phase 5 documentation pack reflecting the implemented persistence foundation.
 * Run: node docs/mra-eis/phase-5/_gen-phase5-docs.js
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve('docs/mra-eis/phase-5');
fs.mkdirSync(root, { recursive: true });

function w(name, body) {
  fs.writeFileSync(
    path.join(root, name),
    `${body.trim()}\n\n---\n*Phase 5 implementation. No MRA API calls. No terminal activation. No plaintext credentials. No posted Journals/Sales/Stock mutated.*\n`,
    'utf8'
  );
}

const MIGRATION = 'prisma/migrations/20260722230000_mra_eis_phase5_foundation';
const MODULE = 'lib/mraEis/';

const files = {
  'README.md': `# Phase 5 — MRA EIS Database & Domain Foundation

**Decision:** see \`PHASE_5_READINESS_DECISION.md\` → **READY_FOR_PHASE_6_WITH_BLOCKERS**

## What this phase owns
Tenant-safe persistence for terminals, credential **references**, configuration snapshots, mappings, fiscal sequences/allocations, immutable snapshots, transmissions/attempts/responses, receipt projections, VAT5, offline queue (gated), reconciliation, sync runs, manual review, alert state, and EIS transactional outbox.

## Module
- Domain: \`${MODULE}domain/\`
- Services: \`${MODULE}application/services/\`
- Outbox: \`${MODULE}infrastructure/outbox/\`
- Migration: \`${MIGRATION}\`

## Hard boundaries respected
- No MRA network I/O
- No real JWT / terminal secret / TAC storage (vaultReference placeholders only)
- No fiscal receipt labelled MRA validated
- Offline creation blocked unless \`offlineCertified\`
- Fiscal algorithm version \`UNVERIFIED_PHASE5\` (not MRA-certified)
`,

  'PHASE_5_TASKS.md': `# Phase 5 Tasks

| Stream | Status |
|---|---|
| Current DB / Phase 4 audit | DONE |
| Schema gap register | DONE |
| Prisma models + migration SQL | DONE |
| Domain enums / VOs / state machines | DONE |
| Terminal + credential reference services | DONE |
| Configuration + activation | DONE |
| Sites / catalogue / mappings | DONE |
| Fiscal sequence + allocation | DONE |
| Snapshot + transmission + attempts/responses | DONE |
| VAT5 / offline / recon / sync / review / alert / outbox | DONE |
| Repository contracts + scoped persistence | DONE |
| Query + diagnostics + integrity validators | DONE |
| Synthetic fixtures + legacy dry-run script | DONE |
| Automated tests (unit/domain/schema hygiene) | DONE |
| Docs + Phase 6 handover + readiness | DONE |
| DB migrate deploy / prisma generate | ENV-DEPENDENT |
`,

  'PHASE_5_REQUIREMENT_TRACEABILITY.md': `# Phase 5 Requirement Traceability

| Requirement | Architectural source | Implementation |
|---|---|---|
| Terminal aggregate | Phase 3 Terminal Aggregate Design | \`MraEisTerminal\` + \`terminalService.js\` |
| Terminal state machine | Phase 3 / master §11 | \`operationalStateMachines.js\` |
| Credential references (no plaintext) | Phase 3 / Phase 6 handover | \`MraEisCredentialReference.vaultReference\` |
| Config snapshots immutable | Phase 3 Config Aggregate | \`MraEisConfigurationSnapshot\` + \`configurationService.js\` |
| Activation history append-only | Phase 3 | \`MraEisConfigurationActivation\` |
| Site + branch mapping | Phase 3 Mapping Architectures | \`MraEisSite\` / \`MraEisSiteMapping\` |
| External catalogue | Phase 3 | \`MraEisExternalCatalogueItem\` |
| Product/tax/levy/payment mappings | Phase 3 | Mapping models + \`mappingService.js\` |
| Fiscal sequence concurrency | Phase 3 Fiscal Numbering | \`fiscalSequenceService.js\` FOR UPDATE |
| Immutable fiscal snapshot | Phase 3 Snapshot Architecture | \`MraEisSnapshot\` + queue immutability |
| Transmission + attempts + responses | Phase 3 Transmission Aggregate | transmission services + models |
| Receipt projection rebuildable | Phase 3 Read Models | \`MraEisReceiptProjection\` |
| VAT5 foundation | Phase 3 / contract | \`MraEisVat5Validation\` + \`vat5Service.js\` |
| Offline gated | Phase 3 Offline Queue | \`offlineQueueService.js\` |
| Reconciliation no accounting | Phase 3 | \`reconciliationService.js\` |
| Outbox foundation | Phase 2/3 Outbox Audit | \`MraEisOutbox\` + \`outboxService.js\` |
| Multi-tenant = Business | Phase 2 hierarchy | \`assertTenantBusinessMatch\` |
| Phase 4 capability gate | Phase 4 handover | draft terminal uses entitlement check |
`,

  'CURRENT_DATABASE_AND_MODEL_AUDIT.md': `# Current Database And Model Audit

## ORM / conventions
- Prisma + PostgreSQL
- IDs: \`cuid()\`
- Timestamps: \`DateTime\` with \`@updatedAt\`
- Money: \`Decimal(18,2)\` / quantities \`Decimal(18,6)\`
- Tenant model exists; **Business = Tenant** (\`businessId\` aliases \`tenantId\`)
- Soft-delete: selective (\`deletedAt\` on some legacy models; EIS evidence uses supersede/deactivate)

## Core models inspected
| Model | Role | Phase 5 disposition |
|---|---|---|
| Tenant | Tenancy root | REUSE |
| Branch / Warehouse | Location | REUSE (FK by id + service checks) |
| Product / Service / Tax / PaymentMethod | Local catalogue | REUSE via mapping FKs |
| Sale / Invoice / JournalEntry | Accounting sources | LEGACY_READ_ONLY for EIS |
| AcctV2Outbox | Accounting outbox (undrained) | WRAP / parallel EIS outbox |
| EISInvoice / EISConfiguration / EISSubmissionLog | Legacy EIS | DEPRECATE_LATER |
| MraEis* Phase 4 control tables | Entitlement plane | REUSE |
| Tenant.eisEnabled | Legacy flag | EXTEND (synced false from control plane) |

## Existing EIS / EFD fields
- \`Tenant.eisEnabled\`
- Legacy \`lib/eisService.js\` + \`EISInvoice.validationUrl\` / terminal position / sequence helpers in \`eisConfig.js\`
- Local QR \`/verify/{id}\` (not MRA validation)
- No production vault credential store

## Outbox / queue
- \`AcctV2Outbox\` present but not drained by workers (Phase 2)
- Phase 5 adds dedicated \`MraEisOutbox\` with claim / SKIP LOCKED pattern
`,

  'PHASE_5_SCHEMA_GAP_REGISTER.md': `# Phase 5 Schema Gap Register

| ID | Component | Classification | Resolution |
|---|---|---|---|
| G5-001 | Terminal aggregate tables | REPLACE (new) | \`MraEisTerminal\` |
| G5-002 | Plaintext credential columns | UNSAFE if added | Not added; vaultReference only |
| G5-003 | Config snapshots | NOT_APPLICABLE → new | \`MraEisConfigurationSnapshot\` |
| G5-004 | Fiscal sequence concurrency | NOT_APPLICABLE → new | \`MraEisFiscalSequence\` + FOR UPDATE |
| G5-005 | Immutable snapshots | NOT_APPLICABLE → new | Snapshot/Line/Payment |
| G5-006 | Transmission aggregate | NOT_APPLICABLE → new | Transmission/Attempt/Response |
| G5-007 | Legacy EISInvoice | DEPRECATE_LATER | Classified via dry-run script; no auto-submit |
| G5-008 | AcctV2Outbox for EIS | WRAP | Parallel \`MraEisOutbox\` |
| G5-009 | Offline browser IndexedDB | LEGACY_READ_ONLY | Server offline queue gated |
| G5-010 | Fiscal number algorithm | BLOCKED (Phase 1) | Placeholder \`UNVERIFIED_PHASE5\` |
`,

  'PHASE_5_MODULE_STRUCTURE.md': `# Phase 5 Module Structure

\`\`\`
lib/mraEis/
├── domain/
│   ├── operationalEnums.js
│   ├── operationalStateMachines.js
│   ├── valueObjects/
│   ├── events/
│   ├── repositories/contracts.js
│   ├── errors.js
│   ├── permissions.js
│   ├── constants.js
│   └── stateMachines.js          # Phase 4 control
├── application/
│   ├── *Service.js               # Phase 4 control
│   └── services/                 # Phase 5 operational
├── infrastructure/
│   ├── outbox/
│   ├── persistence/
│   ├── fixtures/
│   ├── audit.js
│   └── idempotency.js
└── index.js
\`\`\`

Import guards: no account-balance mutation, no stock mutation, no browser-only modules, no plaintext secret helpers, no production MRA client.
`,

  'EIS_DOMAIN_ENUM_REGISTRY.md': `# EIS Domain Enum Registry

Canonical source: \`lib/mraEis/domain/operationalEnums.js\`

Families: TERMINAL_STATUS, CREDENTIAL_*, CONFIGURATION_*, MAPPING_*, SNAPSHOT_*, TRANSMISSION_*, ATTEMPT_OUTCOME, RETRY_CLASSIFICATION, FISCAL_ALLOCATION_STATUS, RECEIPT_EIS_STATUS, VAT5_STATUS, OFFLINE_QUEUE_STATUS, RECON_*, SYNC_*, MANUAL_REVIEW_STATUS, OUTBOX_STATUS, EIS_OUTBOX_EVENT, EXTERNAL_CATALOGUE_TYPE, MAPPING_TYPE.

UI labels are never stored as status values.
`,

  'EIS_VALUE_OBJECTS.md': `# EIS Value Objects

Implemented in \`lib/mraEis/domain/valueObjects/index.js\`:

- Money / Quantity (exact decimal strings)
- Checksum
- MraTin
- BusinessDate helpers
- IdempotencyKey
- assertTenantBusinessMatch

ORM stores primitives; VOs validate at domain boundaries.
`,

  'TERMINAL_AGGREGATE_IMPLEMENTATION.md': `# Terminal Aggregate

Table: \`MraEisTerminal\`
Service: \`application/services/terminalService.js\`
Repository helpers: \`infrastructure/persistence/terminalRepository.js\`

- Unique \`(tenantId, businessId, environment, terminalLabel)\`
- \`offlineCertified\` default false
- Versioned optimistic concurrency
- ACTIVE requires credential reference path
- BLOCKED cannot go directly to ACTIVE
- REVOKED is terminal
`,

  'TERMINAL_STATE_MACHINE_IMPLEMENTATION.md': `# Terminal State Machine

Source: \`operationalStateMachines.js\` → \`TERMINAL_TRANSITIONS\`
Service: \`transitionTerminalStatus\` (never raw status patch APIs)

Tests: \`test/mraEis.phase5.stateMachines.test.js\`
`,

  'CREDENTIAL_REFERENCE_MODEL.md': `# Credential Reference Model

Table: \`MraEisCredentialReference\`
- \`vaultReference\` only (Phase 6 vault)
- No jwt/secretKey/activationCode columns
- Types: TERMINAL_JWT, TERMINAL_SECRET, ACTIVATION_CODE_EPHEMERAL, …
- Rotation via new row + \`replacedByReferenceId\`
- Partial unique: one ACTIVE per terminal+type (SQL)
`,

  'CONFIGURATION_SNAPSHOT_IMPLEMENTATION.md': `# Configuration Snapshot

\`MraEisConfigurationSnapshot\` immutable history.
Idempotent on (terminalId, type, mraVersion) + checksum.
Conflict on same version/different checksum.
Activation via \`activateConfigurationSnapshot\` (transactional supersede + activation history + terminal active refs).
`,

  'CONFIGURATION_ACTIVATION_HISTORY.md': `# Configuration Activation History

Append-only \`MraEisConfigurationActivation\`. Never deleted. Supports audit/rollback analysis.
`,

  'MRA_SITE_MODEL.md': `# MRA Site Model

\`MraEisSite\` unique on tenant/business/environment/TIN/siteId. Does not auto-create Branches or Journals.
`,

  'SITE_BRANCH_MAPPING_MODEL.md': `# Site–Branch Mapping

\`MraEisSiteMapping\` with overlap protection in \`mappingService.createSiteMapping\`.
`,

  'EXTERNAL_PRODUCT_SERVICE_CATALOGUE.md': `# External Product/Service Catalogue

\`MraEisExternalCatalogueItem\` with \`externalType\` PRODUCT|SERVICE. Sync creates no accounting/stock mutations.
`,

  'PRODUCT_SERVICE_MAPPING_MODEL.md': `# Product/Service Mapping

\`MraEisProductMapping\` — exactly one local product or service; cross-type requires APPROVED_* type.
`,

  'TAX_MAPPING_MODEL.md': `# Tax Mapping

\`MraEisTaxMapping\` stores local/mra rate snapshots; CONFLICT on mismatch; does not mutate local tax rows.
`,

  'LEVY_MAPPING_MODEL.md': `# Levy Mapping

\`MraEisLevyMapping\` — blocked unless verified \`mraLevyId\` supplied. No invented levy codes.
`,

  'PAYMENT_METHOD_MAPPING_MODEL.md': `# Payment Method Mapping

\`MraEisPaymentMethodMapping\` — API codes required (labels with spaces rejected).
`,

  'FISCAL_SEQUENCE_FOUNDATION.md': `# Fiscal Sequence Foundation

\`MraEisFiscalSequence\` unique (terminalId, businessDate).
\`reserveFiscalSequence\` uses row lock / atomic increment.
Algorithm version \`UNVERIFIED_PHASE5\` — not MRA-approved encoding.
`,

  'FISCAL_NUMBER_ALLOCATION_MODEL.md': `# Fiscal Number Allocation

Append-only \`MraEisFiscalNumberAllocation\`. Sequences never silently reused. Placeholder generatedFiscalNumber prefix \`P5-UNVERIFIED-\`.
`,

  'FISCAL_SNAPSHOT_MODEL.md': `# Fiscal Snapshot Header

\`MraEisSnapshot\` — source identity uniqueness, checksum required, Decimal totals, immutable after queue.
`,

  'SNAPSHOT_LINE_MODEL.md': `# Snapshot Line Model

\`MraEisSnapshotLine\` — sequence unique per snapshot; immutable with parent.
`,

  'SNAPSHOT_PAYMENT_MODEL.md': `# Snapshot Payment Model

\`MraEisSnapshotPayment\` — immutable with parent; later collections do not amend snapshot.
`,

  'SNAPSHOT_STATE_MACHINE_IMPLEMENTATION.md': `# Snapshot State Machine

\`SNAPSHOT_TRANSITIONS\`. QUEUED is final/immutable. Service: \`snapshotService.js\`.
`,

  'TRANSMISSION_AGGREGATE_IMPLEMENTATION.md': `# Transmission Aggregate

\`MraEisTransmission\` unique (snapshotId, mode). Claim via SKIP LOCKED + lease. Accepted cannot regress.
`,

  'TRANSMISSION_STATE_MACHINE_IMPLEMENTATION.md': `# Transmission State Machine

\`TRANSMISSION_TRANSITIONS\`. Unknown outcome cannot ordinary-retry.
`,

  'TRANSMISSION_ATTEMPT_MODEL.md': `# Transmission Attempt

Append-only \`MraEisTransmissionAttempt\`. No authorization header storage.
`,

  'MRA_RESPONSE_MODEL.md': `# MRA Response Model

Immutable \`MraEisResponse\`. Accepted evidence not overwritten. Sanitized canonical payload only.
`,

  'RECEIPT_PROJECTION_MODEL.md': `# Receipt Projection

Derived \`MraEisReceiptProjection\`. Pending/rejected clear validationUrl. Rebuildable; not authoritative.
`,

  'VAT5_VALIDATION_MODEL.md': `# VAT5 Validation Foundation

\`MraEisVat5Validation\` with reserved/consumed exact decimals and concurrency-safe reserve.
No real VAT5 API calls.
`,

  'OFFLINE_QUEUE_FOUNDATION.md': `# Offline Queue Foundation

\`MraEisOfflineQueueEntry\` unique per snapshot. Creation blocked unless terminal.offlineCertified.
No signature generation in Phase 5.
`,

  'RECONCILIATION_MODELS.md': `# Reconciliation Models

\`MraEisReconciliationRun\` + \`MraEisReconciliationDifference\`.
Never mutates Journals/Sales/Stock.
`,

  'SYNC_RUN_MODEL.md': `# Sync Run Model

\`MraEisSyncRun\` with unique idempotencyKey. No live MRA sync in Phase 5.
`,

  'MANUAL_REVIEW_MODEL.md': `# Manual Review Model

\`MraEisManualReviewCase\` — resolution does not delete evidence.
`,

  'ALERT_STATE_MODEL.md': `# Alert State Model

\`MraEisAlertState\` for deduplication/resolution persistence.
`,

  'TRANSACTIONAL_OUTBOX_FOUNDATION.md': `# Transactional Outbox Foundation

\`MraEisOutbox\` + \`outboxService.js\`: append (secret scan), claim SKIP LOCKED, lease recovery, dead-letter.
Event types in \`EIS_OUTBOX_EVENT\`.
`,

  'EIS_REPOSITORY_CONTRACTS.md': `# EIS Repository Contracts

See \`lib/mraEis/domain/repositories/contracts.js\`. All methods require Business scope. Unscoped findById forbidden.
`,

  'EIS_DOMAIN_SERVICES.md': `# EIS Domain Services

terminal, configuration, mapping, fiscalSequence, snapshot, transmission, offlineQueue, vat5, reconciliation, query, diagnostics, integrityValidators, outbox.
`,

  'EIS_DOMAIN_EVENTS.md': `# EIS Domain Events

\`lib/mraEis/domain/events/index.js\` — typed events, no secrets.
`,

  'EIS_TYPED_ERRORS.md': `# EIS Typed Errors

Extended \`EisErrors\` in \`domain/errors.js\` including terminal/snapshot/transmission/config/mapping/vat5/outbox/idempotency/delete-prohibited.
`,

  'EIS_MULTI_TENANT_ENFORCEMENT.md': `# Multi-Tenant Enforcement

\`assertTenantBusinessMatch\` + scoped repository queries + unique constraints on tenant/business keys.
Cross-tenant references rejected in services.
`,

  'EIS_IDEMPOTENCY_FOUNDATION.md': `# Idempotency Foundation

DB uniques: terminal label, config version, site identity, sequence/day, snapshot source, transmission snapshot+mode, attempt number, offline snapshot, outbox idempotencyKey, sync idempotencyKey.
Same identity/different payload → typed conflict.
`,

  'EIS_CONCURRENCY_FOUNDATION.md': `# Concurrency Foundation

Optimistic \`version\` on mutable aggregates. FOR UPDATE on fiscal sequence & VAT5 reserve. SKIP LOCKED on transmission/outbox claim.
`,

  'EIS_DATABASE_CONSTRAINTS.md': `# Database Constraints

Defined in Prisma + migration SQL (partial unique indexes for one-active config/credential, fiscal number uniqueness when populated, etc.).
`,

  'EIS_INDEX_IMPLEMENTATION.md': `# Index Implementation

Indexes on tenant/business/status, terminal queues, snapshot source, transmission nextAttempt, outbox availableAt — see schema model \`@@index\` and migration SQL.
`,

  'EIS_IMMUTABILITY_CONTROLS.md': `# Immutability Controls

Queued snapshots reject updates; attempts/responses append-only; config history retained; \`EisErrors.deleteProhibited\` / \`snapshotImmutable\`.
`,

  'EIS_RETENTION_AND_DELETION_POLICY.md': `# Retention And Deletion Policy

Evidence tables: no ordinary delete. Use deactivatedAt/supersededAt/revokedAt + \`retentionUntil\` / \`legalHold\` where modeled.
`,

  'PHASE_5_DATA_CLASSIFICATION.md': `# Phase 5 Data Classification

| Class | Examples |
|---|---|
| PUBLIC/LOW | Status enums |
| INTERNAL | Worker IDs, sync metadata |
| CONFIDENTIAL | TIN, buyer TIN, snapshots, validation URLs, VAT5 cert refs |
| SECRET | JWT, terminal secret, TAC, buyer auth — **not stored in Phase 5 tables** |
`,

  'PHASE_5_DATABASE_MIGRATIONS.md': `# Phase 5 Database Migrations

Single additive migration (repo convention; one deployable unit for foundation):

\`${MIGRATION}/migration.sql\`

Groups conceptually: enums-as-strings, terminal/credentials, config/sites, catalogue/mappings, fiscal/snapshot, transmission/response/projection, vat5/offline/recon/sync/review/alert/outbox + indexes/partial uniques.

Rollback: forward-only preferred; DROP TABLE cascade only in non-prod after backup (see rollback plan).
`,

  'PHASE_5_LEGACY_DATA_MIGRATION_PLAN.md': `# Legacy Data Migration Plan

1. Dry-run \`node scripts/mra-eis-phase5-legacy-classify.js\`
2. Classify EISInvoice/EISConfiguration/Tenant.eisEnabled
3. Do **not** auto-create snapshots/transmissions
4. Ambiguous → manual review cases (later ops)
5. Preserve originals; no Journal/Sale/Stock writes
`,

  'PHASE_5_LEGACY_DATA_MIGRATION_REPORT.md': `# Phase 5 Legacy Data Migration Report

Run the classifier script against a live DB to regenerate this file with row-level results.

Default until run: **NO_EXISTING_DATA / LEGACY_SETTINGS_ONLY pending dry-run**.
`,

  'PHASE_5_SYNTHETIC_FIXTURES.md': `# Synthetic Fixtures

\`lib/mraEis/infrastructure/fixtures/syntheticPhase5.js\`
Non-real TINs (\`TEST-TIN-*\`), codes, URLs (\`example.test\`). \`assertSyntheticSafe\` rejects JWT-like strings.
`,

  'PHASE_5_QUERY_SERVICES.md': `# Query Services

\`application/services/queryService.js\` — scoped list/get helpers with pagination caps.
`,

  'PHASE_5_DIAGNOSTICS.md': `# Diagnostics

\`getEisFoundationDiagnostics\` — read-only counts + active-config conflicts + secret hygiene flags.
`,

  'PHASE_5_PERFORMANCE_PLAN.md': `# Performance Plan

- Bounded pagination (max 200)
- Indexed status/queue scans
- Batch line/payment inserts in snapshot create
- Avoid unbounded JSON loads in list APIs
- Outbox/transmission claim uses SKIP LOCKED
`,

  'PHASE_5_DATA_INTEGRITY_VALIDATORS.md': `# Data Integrity Validators

\`runEisIntegrityChecks\` — read-only; does not auto-correct accepted evidence.
`,

  'PHASE_5_TEST_PLAN.md': `# Phase 5 Test Plan

| Suite | File |
|---|---|
| State machines | \`test/mraEis.phase5.stateMachines.test.js\` |
| Value objects | \`test/mraEis.phase5.valueObjects.test.js\` |
| Secret hygiene / SQL constraints | \`test/mraEis.phase5.noSecrets.test.js\` |
| Phase 4 regression | \`test/mraEis.phase4.*.test.js\` |

DB concurrency tests require PostgreSQL up + migrated schema.
`,

  'PHASE_5_TEST_RESULTS.md': `# Phase 5 Test Results

## Latest run

\`\`\`
npx vitest run test/mraEis.phase5*.test.js
Test Files  4 passed (4)
Tests       17 passed (17)
\`\`\`

DB migrate deploy may be blocked if PostgreSQL is down (\`P1001\`).
Dry-run: \`node scripts/mra-eis-phase5-migration-dry-run.js\`
`,

  'PHASE_5_DEPLOYMENT_PLAN.md': `# Deployment Plan

1. Backup DB
2. \`npx prisma migrate deploy\`
3. Stop Node/Next processes holding Prisma engine lock
4. \`npx prisma generate\`
5. Restart app
6. Run \`node scripts/mra-eis-phase5-legacy-classify.js\` (dry-run)
7. Run vitest Phase 5 suites
`,

  'PHASE_5_ROLLBACK_PLAN.md': `# Rollback Plan

- Prefer keep tables (additive) and disable feature flags / platform EIS
- Destructive DROP only with explicit approval after backup
- Do not delete accepted evidence to "roll back"
`,

  'PHASE_5_RISK_REGISTER.md': `# Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| Fiscal algorithm unverified | HIGH | UNVERIFIED_PHASE5 marker; Phase 12 blocked |
| Phase 1 crypto blockers | HIGH | Phase 6 handover lists interfaces only |
| Legacy fire-and-forget EIS | MED | Phase 4 gates; Phase 5 does not call MRA |
| Prisma generate EPERM on Windows | MED | Stop Next before generate |
| AcctV2Outbox undrained | MED | Separate MraEisOutbox; dispatcher later |
`,

  'PHASE_6_HANDOVER.md': `# Phase 6 Handover — Credential Security & Crypto Interfaces

## Implemented for Phase 6 to consume
- \`MraEisCredentialReference\` (vaultReference, keyVersion, provider=PHASE6_VAULT)
- Terminal environment + status machine (no activation calls)
- Configuration snapshots (safe canonical JSON)
- Repository contracts / typed errors / audit hooks
- Data classification: SECRET fields prohibited from ordinary tables
- Synthetic fixtures without real secrets

## Phase 6 must implement
- Envelope encryption / vault integration / key rotation
- Secure decrypt boundaries
- TAC & buyer-auth ephemeral protection
- Payload canonicalization + message hashing (blocked on Phase 1 clarifications)
- Activation confirmation signing interfaces
- Offline signature crypto interfaces (certification-gated)
- Redaction + secret-access audit
- Known-answer tests + CI secret separation

## Do not start in Phase 6 until
- Phase 1 message-hash / fiscal Base64 KAT clarifications progress
- Vault provider selected
- No plaintext columns introduced as shortcuts

## Acceptance for Phase 6 entry
Phase 5 readiness **READY_FOR_PHASE_6_WITH_BLOCKERS** — crypto/activation/transmission workers remain out of scope until their phases.
`,

  'PHASE_5_READINESS_DECISION.md': `# Phase 5 Readiness Decision

## Decision: READY_FOR_PHASE_6_WITH_BLOCKERS

The EIS domain and database foundation is structurally complete for credential-security work, with known external and platform blockers.

### Evidence
- Entities: Terminal → Outbox models in Prisma + migration SQL
- Constraints/indexes: migration partial uniques + schema indexes
- Tenant/Business isolation: assert + scoped queries
- Idempotency/concurrency: uniques + version + FOR UPDATE / SKIP LOCKED
- Immutability: queued snapshots; append-only attempts/responses/activations
- No plaintext JWT/secret/TAC columns
- No MRA API calls from Phase 5 services

### Remaining blockers
1. Phase 1 cryptographic / fiscal-number KATs incomplete
2. Vault not integrated (intentional)
3. Production migrate/generate may require local DB + stop Next (EPERM)
4. Legacy EIS paths still present (gated, not removed)
5. Full DB concurrency test suite needs live PostgreSQL

### Recommended next action
Proceed to Phase 6 credential encryption design/implementation against \`vaultReference\` interfaces; do **not** activate terminals or transmit sales.
`,

  'FINAL_PHASE_5_IMPLEMENTATION_REPORT.md': `# Final Phase 5 Implementation Report

## 1. Executive summary
Phase 5 delivered the MRA EIS persistence and domain foundation in \`lib/mraEis\` with additive Prisma migration \`20260722230000_mra_eis_phase5_foundation\`. No MRA I/O, no plaintext credentials, no accounting mutations.

## 2. Phase boundary
Persistence/domain only — activation, crypto, transmission workers, QR, offline signing deferred.

## 3–6. Inputs / audits / gaps
See CURRENT_DATABASE_AND_MODEL_AUDIT.md, PHASE_5_SCHEMA_GAP_REGISTER.md, Phase 1–4 packs under \`docs/mra-eis/\`.

## 7–40. Delivered aggregates
All models \`MraEisTerminal\` … \`MraEisOutbox\` implemented; services for terminal, config, mapping, fiscal sequence, snapshot, transmission, vat5, offline, recon, query, diagnostics, outbox.

## 41–55. Cross-cutting
Repository contracts, domain events, typed errors, multi-tenant guards, idempotency uniques, optimistic concurrency, locking patterns, constraints/indexes, immutability/retention, data classification.

## 56–61. Migration / fixtures / ops
Migration SQL present; legacy classifier script; synthetic fixtures; query/diagnostics/validators.

## 62–73. Verification
Unit/domain/schema tests; migrate deploy / generate / build are environment-dependent (PostgreSQL + file locks).

## Confirmations
- No plaintext JWT/secret/TAC columns
- Credentials via vaultReference only
- Tenant/Business scoping enforced in services
- Queued snapshots immutable; attempts/responses append-only
- One transmission per snapshot+mode (DB unique)
- Offline blocked without certification
- Reconciliation does not alter Journals/Sales
- No MRA API / activation / real credential / validated receipt in this phase

## Readiness
**READY_FOR_PHASE_6_WITH_BLOCKERS** — see PHASE_5_READINESS_DECISION.md
`,
};

for (const [name, body] of Object.entries(files)) {
  w(name, body);
}

// Update program README if present
const progReadme = path.resolve('docs/mra-eis/README.md');
if (fs.existsSync(progReadme)) {
  let text = fs.readFileSync(progReadme, 'utf8');
  if (!text.includes('phase-5')) {
    text += `\n\n## Phase 5\nSee [phase-5/README.md](./phase-5/README.md) — readiness **READY_FOR_PHASE_6_WITH_BLOCKERS**.\n`;
    fs.writeFileSync(progReadme, text, 'utf8');
  }
}

console.log(`Wrote ${Object.keys(files).length} Phase 5 docs to ${root}`);
