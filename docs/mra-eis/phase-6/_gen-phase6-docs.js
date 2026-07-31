/**
 * Generates Phase 6 documentation pack.
 * Run: node docs/mra-eis/phase-6/_gen-phase6-docs.js
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve('docs/mra-eis/phase-6');
fs.mkdirSync(root, { recursive: true });

function w(name, body) {
  fs.writeFileSync(
    path.join(root, name),
    `${body.trim()}\n\n---\n*Phase 6 implementation. No MRA API calls. No terminal activation. No plaintext credentials persisted. No Sale/Journal/Stock mutations.*\n`,
    'utf8'
  );
}

const MODULE = 'lib/mraEis/infrastructure/security/';
const ENTRY = 'lib/mraEis/security.js';
const MIGRATION = 'prisma/migrations/20260722240000_mra_eis_phase6_security';

const files = {
  'README.md': `# Phase 6 — Credential Security & Cryptographic Foundation

**Decision:** \`READY_FOR_PHASE_7_WITH_BLOCKERS\` (see PHASE_6_READINESS_DECISION.md)

## Entry
- Server module: \`${ENTRY}\`
- Implementation: \`${MODULE}\`
- Migration: \`${MIGRATION}\`
- Admin APIs: \`/api/admin/mra-eis/security/health\`, \`/api/admin/mra-eis/security/credentials/[id]\`

## Provider
**ENV_ENVELOPE** — AES-256-GCM envelope encryption with master key from \`MRA_EIS_MASTER_KEY_v1\` (not stored in DB). Vault/KMS-shaped interface ready for future swap.

## Crypto status
| Capability | Status |
|---|---|
| Envelope encryption | VERIFIED (internal) |
| Activation HMAC-SHA512 | VERIFIED_WITH_TEST_VECTOR (KAT); production disabled |
| Message hash | BLOCKED (Q-010/Q-011) |
| Offline signing | BLOCKED (Q-040 + certification) |
| Fiscal encoding | BLOCKED (Q-021) |
`,

  'PHASE_6_TASKS.md': `# Phase 6 Tasks

| Stream | Status |
|---|---|
| Security/crypto audit | DONE |
| Gap register | DONE |
| Secret types + provider | DONE |
| Envelope encryption + encrypted store | DONE |
| Credential store/lease/rotate/revoke | DONE |
| Ephemeral TAC / buyer-auth | DONE |
| Canonicalization / encoding / constant-time | DONE |
| Crypto registry + KAT / blocked signers | DONE |
| Redaction + audit wiring | DONE |
| Permissions + admin metadata APIs | DONE |
| Security tests | DONE |
| Docs + Phase 7 handover | DONE |
| migrate deploy / prisma generate | ENV-DEPENDENT |
`,

  'PHASE_6_REQUIREMENT_TRACEABILITY.md': `# Phase 6 Requirement Traceability

| Requirement | Source | Implementation |
|---|---|---|
| No plaintext JWT/secret | Phase 5 handover / Phase 3 ADR | \`MraEisEncryptedSecret\` + envelope |
| SecretProvider lease | Phase 3 credential architecture | \`withSecret\` callback |
| Env master key | Phase 2 encryption audit | \`masterKey.js\` |
| Activation HMAC KAT | Phase 1 confirmation contract | \`activationHmac.js\` |
| Message hash blocked | Phase 1 Q-010 | \`messageHasher.js\` fail-closed |
| Offline blocked | Phase 1 Q-040 | \`offlineSigner.js\` |
| Redaction | Phase 2/SecV2 | \`redaction.js\` + audit |
| AAD tenant binding | Phase 6 rules | envelope AAD |
`,

  'CURRENT_SECURITY_AND_CRYPTO_AUDIT.md': `# Current Security And Crypto Audit

## Reuse
- \`lib/encryption.js\` AES-CBC legacy (not Phase 6 final)
- SecV2 \`redactForAudit\` / webhook HMAC / API keys
- Phase 5 \`MraEisCredentialReference.vaultReference\`

## Critical findings (pre-Phase 6)
- Committed \`.env\` / docker-compose secrets (ops hygiene)
- Legacy \`EISConfiguration.settings.token\` plaintext JWT path
- CBC without auth tag

## Phase 6 response
- New ENV_ENVELOPE AES-GCM path for MRA EIS credentials
- Legacy EIS path gated/quarantined (not migrated wholesale in this phase)
- Master key separate from ENCRYPTION_KEY
`,

  'PHASE_6_SECURITY_GAP_REGISTER.md': `# Phase 6 Security Gap Register

| ID | Finding | Severity | Resolution |
|---|---|---|---|
| G6-001 | No SecretProvider | BLOCKER | Implemented ENV_ENVELOPE provider |
| G6-002 | No ciphertext store | BLOCKER | \`MraEisEncryptedSecret\` |
| G6-003 | CBC without AEAD | HIGH | Phase 6 uses AES-GCM; legacy retained read-path only |
| G6-004 | Message-hash unverified | BLOCKER (crypto) | Fail-closed hasher |
| G6-005 | Offline KAT missing | BLOCKER (crypto) | Fail-closed offline signer |
| G6-006 | Production activation signer | HIGH | productionEnabled=false until sandbox |
| G6-007 | Committed secrets in git | CRITICAL (ops) | Documented; rotate outside Phase 6 code |
| G6-008 | Backup dumps unencrypted | HIGH | Documented policy; encrypt before prod secrets |
| G6-009 | Real KMS/Vault absent | MEDIUM | Interface ready; ENV_ENVELOPE transitional |
`,

  'EIS_SECRET_TYPE_REGISTRY.md': `# EIS Secret Type Registry

Source: \`secretTypes.js\` — MRA_TERMINAL_JWT, MRA_TERMINAL_SECRET, TAC, BUYER_AUTH, etc.
Policies define lifetime, browser exposure (always false), allowed operations.
`,

  'SECRET_PROVIDER_ARCHITECTURE.md': `# Secret Provider Architecture

\`storeSecret\` / \`withSecret\` / \`revokeSecret\` / \`rotateCredential\` / \`getCredentialMetadata\` / \`rewrapSecretsBatch\`.
Callback lease pattern — plaintext exists only inside \`withSecret\` callback.
`,

  'VAULT_AND_KMS_INTEGRATION.md': `# Vault And KMS Integration

**Selected:** ENV_ENVELOPE (application envelope encryption).
**Rejected for day-1 on Laragon:** HashiCorp Vault / AWS KMS (no local infra).
**Upgrade path:** implement same interface against Vault Transit / cloud KMS; keep ciphertext schema.
Master key via env; never in DB; separate sandbox/prod keys via deployment env + credential environment AAD.
`,

  'ENVELOPE_ENCRYPTION_IMPLEMENTATION.md': `# Envelope Encryption

AES-256-GCM DEK + wrapped DEK under master key. AAD binds tenant/business/terminal/environment/type/reference.
Unique 12-byte nonce per encryption.
`,

  'ENCRYPTED_SECRET_STORAGE_MODEL.md': `# Encrypted Secret Storage

Tables: \`MraEisEncryptedSecret\`, \`MraEisEphemeralSecret\`, \`MraEisCryptoKeyMeta\`, \`MraEisKeyRotationBatch\`.
No plaintext columns. Not exposed via ordinary tenant CRUD.
`,

  'CREDENTIAL_STORAGE_SERVICE.md': `# Credential Storage Service

\`storeSecret\` encrypts, writes backing row, sets \`vaultReference=env-envelope://v1/<id>\`, rotates prior ACTIVE references.
`,

  'SECRET_LEASE_AND_DECRYPTION_SERVICE.md': `# Secret Lease And Decryption

\`withSecret({...}, fn)\` validates scope, status, service identity, decrypts, audits, invokes callback, clears reference.
`,

  'SECRET_LIFECYCLE_STATE_MACHINE.md': `# Secret Lifecycle

Statuses: PENDING, ACTIVE, EXPIRING, EXPIRED, ROTATION_PENDING, ROTATED, REVOKED, INVALID, ACCESS_BLOCKED, DECRYPTION_FAILED.
Revoked/expired cannot be accessed.
`,

  'KEY_MANAGEMENT_POLICY.md': `# Key Management Policy

Master keys: env-only. Metadata in \`MraEisCryptoKeyMeta\`. Versioned \`MRA_EIS_MASTER_KEY_v1\`. Rotate via rewrap batches.
`,

  'MASTER_KEY_ROTATION_IMPLEMENTATION.md': `# Master Key Rotation

\`rewrapSecretsBatch\` unwraps DEK with old master, rewraps with new, idempotent cursor batches, dry-run supported. No plaintext export.
`,

  'TERMINAL_CREDENTIAL_ROTATION.md': `# Terminal Credential Rotation

\`rotateCredential\` stores new ACTIVE reference and marks previous ROTATED with \`replacedByReferenceId\`.
`,

  'TAC_EPHEMERAL_HANDLING.md': `# TAC Ephemeral Handling

\`storeEphemeralSecret\` / \`withEphemeralSecret\` — short TTL, one-time, ciphertext destroyed after use. Not stored on terminal aggregate.
`,

  'BUYER_AUTHORIZATION_CODE_SECURITY.md': `# Buyer Authorization Code Security

Same ephemeral store with type \`MRA_BUYER_AUTHORIZATION_CODE\`. Not in customer master data or snapshots.
`,

  'JWT_SECURITY.md': `# JWT Security

Stored only via envelope as \`MRA_TERMINAL_JWT\`. Never returned to browser. Access limited to MRA_HTTP_AUTHORIZATION operation.
`,

  'TERMINAL_SECRET_SECURITY.md': `# Terminal Secret Security

Accessed only via cryptographic operations (activation confirmation / future hash/offline). Callers use credentialReferenceId + operation, not raw secret APIs.
`,

  'PAYLOAD_CANONICALIZATION_IMPLEMENTATION.md': `# Payload Canonicalization

\`PAYLOAD_CANONICALIZATION_V1\` — sorted keys, preserved arrays, UTF-8, checksum.
`,

  'DECIMAL_SERIALIZATION.md': `# Decimal Serialization

\`serializeExactDecimal\` — rejects scientific notation / non-finite; fixed scale strings.
`,

  'DATE_TIME_SERIALIZATION.md': `# Date Time Serialization

\`serializeBusinessDate\` → YYYY-MM-DD. Unverified MRA-specific Julian/Base64 date encodings remain blocked (Q-021).
`,

  'CRYPTOGRAPHIC_VERSION_REGISTRY.md': `# Cryptographic Version Registry

Source: \`cryptoRegistry.js\`. Fail-closed for BLOCKED / REQUIRES_MRA_CLARIFICATION. Production rejects non-productionEnabled entries.
`,

  'ACTIVATION_CONFIRMATION_SIGNER.md': `# Activation Confirmation Signer

HMAC-SHA512(TAC, secretKey) → standard Base64. KAT: MRA/123456.
Status: VERIFIED_WITH_TEST_VECTOR; \`productionEnabled=false\` until sandbox verification.
`,

  'REQUEST_MESSAGE_HASHING_IMPLEMENTATION.md': `# Request Message Hashing

\`hashEisMessage\` throws \`EIS_CRYPTOGRAPHIC_CONTRACT_UNVERIFIED\` (Q-010/Q-011).
`,

  'OFFLINE_SIGNING_SECURITY_BOUNDARY.md': `# Offline Signing Security Boundary

\`signOfflineTransaction\` throws \`EIS_OFFLINE_SIGNING_UNAVAILABLE\` until Q-040 KAT + certification.
`,

  'BASE64_AND_ENCODING_UTILITIES.md': `# Base64 And Encoding

\`encodeBase64Standard\`, \`encodeBase64UrlSafe\`, \`encodeBase64UrlSafeWithoutPadding\`, \`utf8Bytes\`, hex.
`,

  'CONSTANT_TIME_COMPARISON.md': `# Constant-Time Comparison

\`constantTimeEqual\` via \`crypto.timingSafeEqual\`.
`,

  'SECRET_REDACTION_IMPLEMENTATION.md': `# Secret Redaction

\`redactSecrets\` + \`assertNoSecretMaterial\`. Wired into \`recordEisControlAudit\`.
`,

  'ERROR_SANITIZATION.md': `# Error Sanitization

\`CryptoErrors\` — stable codes, no secret/ciphertext in messages or details.
`,

  'SECRET_ACCESS_PERMISSIONS.md': `# Secret Access Permissions

system.eis.security.* / credentials.* metadata permissions; tenant eis.terminal.credentials.*; **no** plaintext view permission.
`,

  'SERVICE_IDENTITY_SECURITY.md': `# Service Identity Security

\`serviceIdentity.js\` — allowed secret types and operations per trusted backend service.
`,

  'SECRET_ACCESS_AUDIT_EVENTS.md': `# Secret Access Audit Events

CREDENTIAL_ENCRYPTED, ACCESS_GRANTED/DENIED, DECRYPTION_FAILED, REVOKED, TAC/BUYER ephemeral events — redacted metadata.
`,

  'SECURITY_METRICS.md': `# Security Metrics

In-process counters via \`securityMetrics.js\` (stores, retrievals, denials, blocked crypto, etc.).
`,

  'SECURITY_ALERTS.md': `# Security Alerts

Alert persistence reuses Phase 5 \`MraEisAlertState\`. Critical patterns: integrity failure, cross-tenant denial, leakage blocked — raise via diagnostics/ops (no live paging wired).
`,

  'SECRET_LEAKAGE_DETECTION.md': `# Secret Leakage Detection

\`assertNoSecretMaterial\` for payloads; schema tests forbid plaintext columns; redaction for logs/audit.
`,

  'SERVER_ONLY_MODULE_ENFORCEMENT.md': `# Server-Only Module Enforcement

\`assertServerOnly\` throws if \`window\` is defined. Entry: \`${ENTRY}\`.
`,

  'SECURITY_API_AND_SERVER_ACTIONS.md': `# Security API And Server Actions

GET metadata/health only. **No** GetPlaintextCredential / RevealJWT / ExportCredentials endpoints.
`,

  'SECURITY_ADMIN_UI.md': `# Security Admin UI

Phase 6 ships API-only metadata. UI may show status/expiry/keyVersion later — never ciphertext.
`,

  'SECURITY_RATE_LIMITING.md': `# Security Rate Limiting

Apply existing platform rate limits to TAC/buyer-auth submission in Phase 7 routes. Phase 6 documents requirement; no public TAC endpoint exposed yet.
`,

  'MEMORY_AND_PROCESS_SAFETY.md': `# Memory And Process Safety

Narrow callback scope; DEK buffers zero-filled after wrap; no secret in retries/outbox; managed runtime cannot guarantee full wipe — compensate with isolation.
`,

  'CRYPTOGRAPHIC_PROCESS_ISOLATION.md': `# Cryptographic Process Isolation

**Selected:** in-process Node crypto within API/worker with service-identity gates.
**Rejected day-1:** separate crypto microservice (ops cost).
**Future:** KMS/Vault Transit so app never holds long-lived terminal secret.
`,

  'BACKUP_AND_RESTORE_SECURITY.md': `# Backup And Restore Security

Ciphertext may appear in DB dumps — encrypt backups at rest. Production master keys must not be loaded in development restores. Restore tests: matching env decrypts; mismatched master fails.
`,

  'DISASTER_RECOVERY_SECURITY.md': `# Disaster Recovery Security

If master key unavailable: EIS credential ops pause; local accounting continues. Rotate/rewrap after key recovery. Preserve ciphertext evidence.
`,

  'CI_CD_SECRET_SECURITY.md': `# CI/CD Secret Security

Never commit \`MRA_EIS_MASTER_KEY*\`. Tests use \`MRA_EIS_ALLOW_TEST_MASTER_KEY=1\`. Mask logs. No secrets in Docker layers.
`,

  'CONTAINER_AND_HOST_SECURITY.md': `# Container And Host Security

Inject master key via runtime env/secrets manager; least privilege process user; no world-readable secret files.
`,

  'DATABASE_SECURITY.md': `# Database Security

Encrypted secret tables excluded from generic admin CRUD. App role holds ciphertext only; master key never in DB.
`,

  'CRYPTOGRAPHIC_DEPENDENCY_REVIEW.md': `# Cryptographic Dependency Review

| Package | Purpose | Notes |
|---|---|---|
| Node \`crypto\` | AES-GCM, HMAC, SHA-256, randomBytes, timingSafeEqual | Platform-native; preferred |
| \`lib/encryption.js\` CBC | Legacy EIS only | Do not use for Phase 6 credentials |
| jsonwebtoken / bcrypt | App auth | Not used for MRA terminal secrets |
`,

  'PHASE_6_THREAT_MODEL.md': `# Phase 6 Threat Model

Threats covered: DB/backup theft (ciphertext+need master), cross-tenant ciphertext move (AAD), nonce reuse (random IV), secret logging (redaction), browser exposure (server-only), algorithm downgrade (registry), TAC replay (one-time ephemeral), env confusion (AAD+checks). Residual: master key compromise → emergency rotate + rewrap.
`,

  'ALGORITHM_DOWNGRADE_PROTECTION.md': `# Algorithm Downgrade Protection

Explicit version IDs; production rejects non-enabled; blocked contracts throw; client cannot select algorithm versions.
`,

  'TEST_FIXTURE_SECURITY.md': `# Test Fixture Security

Synthetic secrets only. Official public KAT (MRA/123456). No production ciphertext or real TAC/JWT.
`,

  'PHASE_6_SECURITY_TEST_PLAN.md': `# Phase 6 Security Test Plan

\`test/mraEis.phase6.security.test.js\` — encryption, tamper, KAT, blocked hash/offline, canonicalization, redaction, server-only, schema hygiene.
`,

  'PHASE_6_SECURITY_TEST_RESULTS.md': `# Phase 6 Security Test Results

Run: \`npx vitest run test/mraEis.phase6.security.test.js\`
`,

  'PHASE_6_PENETRATION_TEST_REPORT.md': `# Phase 6 Penetration-Style Test Report

Covered via unit assertions: foreign tenant AAD fail, env mismatch, revoked/expired denials (provider), no plaintext API, blocked unverified crypto. Full interactive pentest deferred to staging with synthetic data only.
`,

  'PHASE_6_DEPLOYMENT_PLAN.md': `# Deployment Plan

1. Set \`MRA_EIS_MASTER_KEY_v1\` (openssl rand -hex 32) per environment
2. \`npx prisma migrate deploy\`
3. \`npx prisma generate\` (stop Next if EPERM)
4. Verify \`GET /api/admin/mra-eis/security/health\` → masterKeyConfigured=true
5. Run Phase 6 vitest suite
`,

  'PHASE_6_ROLLBACK_PLAN.md': `# Rollback Plan

Keep ciphertext tables (additive). Disable credential store feature / pause EIS platform. Do not drop encrypted tables if any credentials stored. Master key retirement only after rewrap verification window.
`,

  'PHASE_6_INCIDENT_RUNBOOKS.md': `# Incident Runbooks

**Suspected key compromise:** revoke affected credentials, rotate master key, rewrap batch, audit access denials.
**Integrity failure:** pause EIS, preserve ciphertext, open manual review, do not auto-decrypt.
**Leakage in logs:** rotate exposed credential, scrub logs, alert.
`,

  'PHASE_6_RISK_REGISTER.md': `# Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| Message-hash unknown | HIGH | Fail-closed |
| Offline KAT missing | HIGH | Fail-closed |
| Activation sandbox pending | MED | productionEnabled=false |
| ENV master key ops | MED | Separate keys; backup policy |
| Legacy EIS plaintext token | HIGH | Quarantine; do not use for Phase 7 |
`,

  'PHASE_7_HANDOVER.md': `# Phase 7 Handover — Terminal Activation

## Consume from Phase 6
- \`storeSecret\` / \`withSecret\` / \`storeEphemeralSecret\` / \`withEphemeralSecret\`
- \`signActivationConfirmation\` (sandbox/KAT only until sandbox-verified)
- \`hashEisMessage\` / \`signOfflineTransaction\` remain blocked
- Crypto registry statuses
- Redaction + audit + permissions
- Admin metadata APIs

## Phase 7 must implement
- Setup wizard, TAC entry (POST body only), activation request construction
- Persist JWT+secret via \`storeSecret\` after activation response
- Confirmation using signer + ephemeral TAC
- Timeout/retry/reactivation UX
- Still no sales transmission

## Blockers carried in
- Q-010/Q-011 message-hash
- Q-016 activation timeout recovery
- Q-017–019 SaaS terminal identity
- Q-040 offline
- Sandbox verification of activation HMAC
`,

  'PHASE_6_READINESS_DECISION.md': `# Phase 6 Readiness Decision

## Decision: READY_FOR_PHASE_7_WITH_BLOCKERS

Credential security foundation is implemented and fail-closed for unverified crypto. Terminal onboarding may proceed for **sandbox structural flows**, but production activation/signing/hash/offline remain gated.

### Results
- SecretProvider: ENV_ENVELOPE implemented
- Encryption: AES-256-GCM envelope + AAD binding
- Rotation/revoke/rewrap: implemented
- TAC/buyer ephemeral: implemented
- Activation signer: KAT pass; production disabled
- Message hash / offline: blocked
- Redaction + audit: wired
- Backup/CI: policy documented; ops must set keys

### Remaining blockers
1. Phase 1 message-hash + offline + SaaS identity clarifications
2. Sandbox verification of activation HMAC
3. Real KMS/Vault optional upgrade
4. Apply migration when DB available
5. Rotate any historically committed env secrets (ops)

### Next action
Implement Phase 7 terminal onboarding against \`lib/mraEis/security.js\` without inventing crypto.
`,

  'FINAL_PHASE_6_IMPLEMENTATION_REPORT.md': `# Final Phase 6 Implementation Report

## Executive summary
Phase 6 delivered envelope-encrypted credential storage, secret leases, ephemeral TAC/buyer-auth handling, deterministic canonicalization, a cryptographic version registry with fail-closed unverified algorithms, activation HMAC KAT support, redaction, and metadata-only admin APIs — without MRA network I/O or terminal activation.

## Confirmations
- No plaintext JWT/terminal secret/TAC retained in ordinary tables
- Secrets not returned to browsers; server-only module guard
- Audit/outbox/redaction exclude secrets
- Tenant/business/terminal/environment binding via AAD + service checks
- Unverified algorithms fail closed
- No Sale/Journal/Stock changes; no MRA calls

## Readiness
**READY_FOR_PHASE_7_WITH_BLOCKERS**
`,
};

for (const [name, body] of Object.entries(files)) {
  w(name, body);
}

const prog = path.resolve('docs/mra-eis/README.md');
if (fs.existsSync(prog)) {
  let text = fs.readFileSync(prog, 'utf8');
  if (!text.includes('phase-6')) {
    text += `\n\n## Phase 6\nSee [phase-6/README.md](./phase-6/README.md) — readiness **READY_FOR_PHASE_7_WITH_BLOCKERS**.\n`;
    fs.writeFileSync(prog, text, 'utf8');
  }
}

console.log(`Wrote ${Object.keys(files).length} Phase 6 docs to ${root}`);
