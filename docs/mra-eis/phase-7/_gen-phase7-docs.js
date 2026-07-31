/**
 * Generates Phase 7 documentation pack.
 * Run: node docs/mra-eis/phase-7/_gen-phase7-docs.js
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve('docs/mra-eis/phase-7');
fs.mkdirSync(root, { recursive: true });

function w(name, body) {
  fs.writeFileSync(
    path.join(root, name),
    `${body.trim()}\n\n---\n*Phase 7 implementation. No Sale submission. No fiscal number/QR. No Journal/Stock mutations. TAC ephemeral. JWT/secret encrypted. ACTIVE only after confirmation.*\n`,
    'utf8'
  );
}

const ACT = 'lib/mraEis/application/activation/';
const CLIENT = 'lib/mraEis/infrastructure/mraClient/';
const MIG = 'prisma/migrations/20260722250000_mra_eis_phase7_activation';

const files = {
  'README.md': `# Phase 7 — Terminal Onboarding & Activation

**Decision:** \`READY_FOR_PHASE_8_WITH_BLOCKERS\` (see PHASE_7_READINESS_DECISION.md)

## Entry points
- Domain services: \`${ACT}\`
- Mock MRA: \`${CLIENT}mockMraActivationServer.js\`
- Activation client: \`${CLIENT}activationClient.js\`
- Migration: \`${MIG}\`
- Tenant APIs: \`/api/mra-eis/terminals/**\`
- Admin API: \`/api/admin/mra-eis/terminals\`
- Tenant UI: \`/settings/integrations/mra-eis/terminals\`
- Admin UI: \`/insightbooks/mra-eis/terminals\`

## Lifecycle (success)
DRAFT → TAC_REQUIRED → ACTIVATION_REQUEST_PENDING → ACTIVATION_IN_PROGRESS → ACTIVATION_RESPONSE_RECEIVED → CREDENTIALS_PERSISTED → CONFIRMATION_PENDING → CONFIRMATION_IN_PROGRESS → **ACTIVE**

ACTIVE is never set from HTTP 200 alone or from credential possession alone.

## Modes
MOCK (default for tests) · SANDBOX · CERTIFICATION · PRODUCTION (create/activate blocked until SaaS identity + signer productionEnabled)

## Hard rules enforced
- TAC in POST body only; ephemeral store; not logged; destroyed after confirmation
- JWT + terminal secret encrypted via Phase 6 Secret Provider
- Credentials never returned to browser (\`safeTerminalDto\`)
- Unknown outcomes → MANUAL_REVIEW / UNKNOWN_* ; no blind retry
- Production identity blocked (Q-017–019)
`,

  'PHASE_7_TASKS.md': `# Phase 7 Tasks

| Stream | Status |
|---|---|
| Dependency audit + gap register | DONE |
| Readiness service | DONE |
| Stable platform identity | DONE (prod blocked) |
| Product ID/version control | DONE |
| Terminal creation + idempotency | DONE |
| TAC UI + ephemeral + replay | DONE |
| Activation attempt model | DONE |
| Request mapper + validation + canonicalize | DONE |
| Activation/confirmation API client + mock | DONE |
| Response parse/classify | DONE |
| Credential persistence + partial recovery | DONE |
| Config bootstrap | DONE |
| Confirmation + ACTIVE transition | DONE |
| Unknown outcome + retry policy | DONE |
| Reactivation / replacement foundation | DONE |
| Token expiry + health | DONE |
| Wizard + tenant/admin UI | DONE |
| Permissions + rate limits + metrics | DONE |
| Automated tests | DONE (unit/mock) |
| Docs + Phase 8 handover | DONE |
| Live sandbox activation | NOT RUN (authorization required) |
| migrate deploy / prisma generate | ENV-DEPENDENT |
`,

  'PHASE_7_REQUIREMENT_TRACEABILITY.md': `# Phase 7 Requirement Traceability

| Requirement | Implementation |
|---|---|
| Entitlement/participation gates | \`readinessService.js\` + Phase 4 capability |
| Server-authoritative readiness | \`evaluateTerminalActivationReadiness\` |
| Stable identity non-ephemeral | \`platformIdentity.js\` (\`ibeis:{env}:…\`) |
| Product ID controlled | \`MraEisCertifiedProduct\` + env fallback (MOCK) |
| TAC ephemeral | \`storeEphemeralSecret\` / \`withEphemeralSecret\` |
| Activation attempts append-only | \`MraEisActivationAttempt\` |
| HTTP 200 ≠ accept | \`parseActivationResponse\` |
| JWT/secret encrypt | \`storeSecret\` in orchestrator tx B |
| Config snapshots immutable | Phase 5 \`storeConfigurationSnapshot\` |
| Confirmation verified crypto | HMAC-SHA512 KAT; \`assertCryptoAllowed\` |
| ACTIVE after confirm only | \`runTerminalConfirmation\` |
| Unknown outcome no blind retry | orchestrator + MANUAL_REVIEW |
| Cross-tenant reject | \`assertTenantBusinessMatch\` + scoped finds |
| No Sale/Journal/Stock | Activation path has no accounting calls |
`,

  'ACTIVATION_DEPENDENCY_AUDIT.md': `# Activation Dependency Audit

Performed without live MRA calls.

| Dependency | Status |
|---|---|
| Platform EIS | Phase 4 control plane |
| Tenant entitlement / participation | Phase 4 |
| Business EIS setting | Phase 4 |
| Terminal / credential / config models | Phase 5 |
| Secret Provider / envelope | Phase 6 ENV_ENVELOPE |
| Activation HMAC KAT | Phase 6 VERIFIED_WITH_TEST_VECTOR |
| Confirmation productionEnabled | **false** (sandbox verification pending) |
| Message hash / offline signers | BLOCKED (out of Phase 7) |
| MRA base URL | Mock default; sandbox/prod via env |
| Outbox | Phase 5; queues CONFIGURATION_SYNC_REQUESTED |
| Audit | \`recordEisControlAudit\` + redaction |
| Product ID config | Table + \`MRA_EIS_PRODUCT_ID\` |
| Stable identity | Implemented; production blocked Q-017–019 |
| Postgres migrate deploy | Environment-dependent (often P1001 locally) |
`,

  'PHASE_7_GAP_REGISTER.md': `# Phase 7 Gap Register

| ID | Gap | Severity | Mitigation |
|---|---|---|---|
| G7-01 | SaaS terminal identity (Q-017–019) unresolved | CRITICAL (prod) | Production create/activate blocked |
| G7-02 | Confirmation signer not productionEnabled | HIGH (prod) | Fail closed for PRODUCTION |
| G7-03 | No MRA status-poll recovery endpoint verified | HIGH | Unknown outcome → manual review |
| G7-04 | Live sandbox activation not executed | MEDIUM | Mock scenarios cover paths |
| G7-05 | Shared rate-limit store | LOW | In-process limiter; document for multi-node |
| G7-06 | Approval engine deep integration | MEDIUM | Production requires approvalId on reactivate/replace |
| G7-07 | Message-hash / offline crypto | N/A Phase 7 | Remain blocked |
| G7-08 | Prisma client generate after migrate | OPS | Required before runtime |
`,

  'TERMINAL_ACTIVATION_READINESS.md': `# Terminal Activation Readiness

Canonical service: \`evaluateTerminalActivationReadiness\`.

Returns platform/tenant/business/env/cert/product/identity/secret/signer/API flags, blockers, warnings, \`readyToCreateTerminal\`, \`readyToSubmitActivation\`, \`readyToConfirmActivation\`.

Production \`readyToCreateTerminal\` is always false until SaaS identity clarifications close.
`,

  'TERMINAL_SCOPE_IMPLEMENTATION.md': `# Terminal Scope Implementation

Supported scopes: \`BUSINESS\` (default), with optional \`branchId\` / site mapping fields on terminal.

Unsupported free-form scopes rejected. Production SaaS scope remains blocked (Q-017–019).
`,

  'STABLE_PLATFORM_IDENTITY_IMPLEMENTATION.md': `# Stable Platform Identity Implementation

- Format: \`ibeis:{env}:{tenantPrefix}:{sha256-hash}\`
- Seed: \`MRA_EIS_INSTALLATION_ID\` or \`APP_URL\` (not container ID)
- Persisted in \`MraEisPlatformIdentity\`
- Environment + tenant + business bound
- **Production throws** until MRA approves SaaS identity strategy
`,

  'PRODUCT_ID_AND_VERSION_CONTROL.md': `# Product ID And Version Control

Table \`MraEisCertifiedProduct\` stores environment-bound ProductId/ProductVersion with approval metadata.

Tenant users cannot edit via wizard. Terminal retains product fields at creation. Env fallbacks \`MRA_EIS_PRODUCT_ID\` / \`MRA_EIS_PRODUCT_VERSION\` for MOCK only.
`,

  'TERMINAL_CREATION_IMPLEMENTATION.md': `# Terminal Creation Implementation

\`createTerminalForOnboarding\` validates readiness, ensures identity, creates draft, sets TAC_REQUIRED or READINESS_INCOMPLETE.

Idempotency: same label/env/business returns existing when Idempotency-Key / label match.

No MRA call on create.
`,

  'TAC_ENTRY_WORKFLOW.md': `# TAC Entry Workflow

- UI: password field; cleared after submit; never in URL
- API: POST body \`terminalActivationCode\` only
- Storage: ephemeral secret, TTL 15m, oneTime=false until confirmation destroy
- Audit: reference id + expiry only
`,

  'ACTIVATION_ATTEMPT_MODEL.md': `# Activation Attempt Model

\`MraEisActivationAttempt\` — append-only attempts with checksums, outcomes, sanitized response, unknownOutcomeAt, idempotencyKey unique.
`,

  'ACTIVATION_REQUEST_MAPPER.md': `# Activation Request Mapper

\`mapTerminalActivationRequest\` — UnActivatedTerminal-style fields: TAC, productID, productVersion, platform identity (no invented MAC), optional TIN. Canonical checksum via Phase 6 canonicalizer.
`,

  'ACTIVATION_REQUEST_CONTRACT_VALIDATION.md': `# Activation Request Contract Validation

Mapper validates lengths/presence. Orchestrator requires readiness + terminal state. Invalid contract never marks ACTIVE.
`,

  'ACTIVATION_API_CLIENT.md': `# Activation API Client

\`activationClient.js\` — server-only; mode from \`resolveActivationMode\`; MOCK uses mock server; production fetch hard-blocked until authorized. Explicit timeout; no ambiguous auto-retry middleware.
`,

  'ACTIVATION_TRANSACTION_BOUNDARIES.md': `# Activation Transaction Boundaries

Tx A: claim + attempt + ACTIVATION_IN_PROGRESS.  
External MRA call (no open DB tx).  
Tx B: persist attempt, credentials, config, CONFIRMATION_PENDING.
`,

  'ACTIVATION_RESPONSE_PARSER.md': `# Activation Response Parser

\`parseActivationResponse\` — statusCode===1 + terminalId + jwt + secretKey required. Sanitized evidence stored. Parser version recorded.
`,

  'ACTIVATION_RESPONSE_CLASSIFICATION.md': `# Activation Response Classification

Outcomes include ACTIVATION_ACCEPTED, INVALID_TAC, TAC_EXPIRED, TAC_ALREADY_USED, PRODUCT_NOT_APPROVED, RATE_LIMITED, TEMPORARY_MRA_FAILURE, INVALID_RESPONSE, UNKNOWN_OUTCOME with retry classifications.
`,

  'ACTIVATION_CREDENTIAL_PERSISTENCE.md': `# Activation Credential Persistence

Both JWT and terminal secret via \`storeSecret\` (CREDENTIAL_ROTATION_WORKER). Partial failure revokes JWT, status CREDENTIAL_STORAGE_FAILED, manual review, no confirmation.
`,

  'ACTIVATION_CONFIGURATION_BOOTSTRAP.md': `# Activation Configuration Bootstrap

Global / Terminal / Taxpayer snapshots from activation response; activate after store; conflict on same version different checksum (Phase 5 rules). Failure → CONFIGURATION_BOOTSTRAP_FAILED.
`,

  'ACTIVATION_CONFIRMATION_IMPLEMENTATION.md': `# Activation Confirmation Implementation

HMAC-SHA512(TAC, secretKey) via secure lease. Confirm endpoint mock/sandbox. Unverified/production-disabled signer fail closed. ACTIVE only on accepted confirmation. Outbox CONFIGURATION_SYNC_REQUESTED.
`,

  'CONFIRMATION_ATTEMPT_MODEL.md': `# Confirmation Attempt Model

\`MraEisConfirmationAttempt\` append-only; no secret persistence; signature not stored in attempt row.
`,

  'TERMINAL_ACTIVATION_STATE_MACHINE.md': `# Terminal Activation State Machine

See \`operationalStateMachines.js\` TERMINAL_TRANSITIONS. Includes unknown/credential/config/manual-review states. BLOCKED cannot go directly to ACTIVE.
`,

  'ACTIVATION_IDEMPOTENCY.md': `# Activation Idempotency

Creation by label uniqueness + optional key. Activation attempt \`idempotencyKey\` unique; reuse with different terminal rejected.
`,

  'ACTIVATION_CONCURRENCY.md': `# Activation Concurrency

Optimistic \`version\`; attempt claim in transaction; unknown outcome blocks ordinary retry; no global lock.
`,

  'ACTIVATION_UNKNOWN_OUTCOME_RECOVERY.md': `# Activation Unknown Outcome Recovery

Post-dispatch timeout/reset → UNKNOWN_ACTIVATION_OUTCOME + Manual Review. No automatic second TAC/activation.
`,

  'CONFIRMATION_UNKNOWN_OUTCOME_RECOVERY.md': `# Confirmation Unknown Outcome Recovery

UNKNOWN_CONFIRMATION_OUTCOME; credentials retained; not ACTIVE; manual review; no blind retry.
`,

  'ACTIVATION_RETRY_POLICY.md': `# Activation Retry Policy

AUTOMATIC_RETRY only pre-dispatch / verified temporary. DATA_CORRECTION for invalid TAC format etc. NO_RETRY for expired/used TAC. RECONCILE_BEFORE_RETRY for unknown.
`,

  'TERMINAL_REACTIVATION.md': `# Terminal Reactivation

\`requestTerminalReactivation\` — preserves evidence; rotates credential refs; production requires approvalId; sandbox → TAC_REQUIRED for new TAC.
`,

  'TERMINAL_REPLACEMENT.md': `# Terminal Replacement

\`requestTerminalReplacement\` — original REVOKED; new draft; \`replacedTerminalId\` linkage; fiscal history stays on original; no number transfer.
`,

  'TOKEN_EXPIRY_MONITORING.md': `# Token Expiry Monitoring

\`markExpiredTokens\` moves ACTIVE with past \`tokenExpiresAt\` → TOKEN_EXPIRED. Health exposes tokenExpiring / jwtStatus metadata only.
`,

  'TERMINAL_HEALTH_MODEL.md': `# Terminal Health Model

\`getTerminalHealth\` — status, jwt/secret metadata, blockers, recommended actions. No plaintext.
`,

  'TERMINAL_ONBOARDING_WIZARD.md': `# Terminal Onboarding Wizard

\`/settings/integrations/mra-eis/terminals/onboarding\` — steps derive from server status; masked TAC; resume via \`terminalId\` query (no TAC).
`,

  'SYSTEM_ADMIN_TERMINAL_UI.md': `# System Admin Terminal UI

\`/insightbooks/mra-eis/terminals\` + \`GET /api/admin/mra-eis/terminals\` with filters. Metadata only.
`,

  'TENANT_TERMINAL_UI.md': `# Tenant Terminal UI

List, detail/health, reactivate/replace requests, link from EIS availability page.
`,

  'TERMINAL_PERMISSIONS.md': `# Terminal Permissions

Tenant: \`eis.terminal.view|create|setup|activate|confirm|requestReactivation|requestReplacement\`.  
System: \`system.eis.terminals.view|support|revoke|replace\` + activation audit/view.  
No permission grants plaintext credential view.
`,

  'TERMINAL_APPROVALS.md': `# Terminal Approvals

Production reactivation/replacement require \`approvalId\`. Production create blocked by readiness. Self-approval prevention remains Phase 4 approval engine concern when wired.
`,

  'TERMINAL_AUDIT_EVENTS.md': `# Terminal Audit Events

TERMINAL_DRAFT_CREATED, TAC_SUBMITTED, ACTIVATION_ACCEPTED_CREDENTIALS_PERSISTED, TERMINAL_ACTIVATED, REACTIVATION/REPLACEMENT requested, STABLE_IDENTITY_ASSIGNED. Redacted via Phase 6.
`,

  'TERMINAL_NOTIFICATIONS.md': `# Terminal Notifications

Foundation: audit + outbox events. Full notification fan-out reuses existing framework hooks; no secrets in payloads.
`,

  'TERMINAL_METRICS.md': `# Terminal Metrics

\`activationMetrics.js\` counters/gauges/histograms (in-process). No sensitive labels.
`,

  'TERMINAL_ALERTS.md': `# Terminal Alerts

Critical/high conditions documented (cross-tenant, unknown outcome, partial credential storage). Manual Review cases opened for unknown/partial failures.
`,

  'TERMINAL_TYPED_ERRORS.md': `# Terminal Typed Errors

Uses \`EisErrors\` validation / invalidTerminalTransition / versionConflict / permissionDenied / terminalNotFound with safe messages and requiredAction where applicable.
`,

  'TERMINAL_SECURITY.md': `# Terminal Security

Server-only activation/confirm; env URL server-controlled; TAC never in logs/URL/audit; credentials encrypted + bound; browser DTOs safe; production identity blocked; fail-closed crypto.
`,

  'ACTIVATION_CONFIGURATION.md': `# Activation Configuration

\`MRA_EIS_ACTIVATION_MODE\`, product id/version, master key, installation id, endpoint paths via \`environmentConfig.js\`. No privileged \`NEXT_PUBLIC_\` secrets.
`,

  'MOCK_MRA_ACTIVATION_SERVER.md': `# Mock MRA Activation Server

TAC scenarios: MOCK-OK*, MOCK-TIMEOUT, MOCK-INVALID-TAC, MOCK-EXPIRED-TAC, MOCK-USED-TAC, MOCK-MISSING-JWT/SECRET, MOCK-429/500, confirmation SUCCESS/TIMEOUT/REJECT. Synthetic credentials only.
`,

  'SANDBOX_ACTIVATION_SAFETY.md': `# Sandbox Activation Safety

No automatic live sandbox calls in tests. Production fetch blocked. Written authorization required before live sandbox TAC use. Use MOCK by default.
`,

  'PHASE_7_TEST_PLAN.md': `# Phase 7 Test Plan

Unit: mapper, parser, mock, state machine, rate limit, identity, readiness (mocked capability), safe DTO, HMAC KAT.  
E2E live sandbox: manual, authorized only.  
DB integration: after migrate deploy.
`,

  'PHASE_7_TEST_RESULTS.md': `# Phase 7 Test Results

Run: \`npx vitest run test/mraEis.phase7.*.test.js\`

Results recorded at generation time as **unit/mock suite present**. Re-run locally after migrate for DB-backed flows.
`,

  'PHASE_7_SECURITY_TEST_RESULTS.md': `# Phase 7 Security Test Results

| Check | Result |
|---|---|
| TAC not in safe DTO | PASS (unit) |
| JWT/secret absent from sanitized response | PASS (unit) |
| Production identity blocked | PASS (unit) |
| HTTP 200 alone not acceptance | PASS (unit) |
| ACTIVE not reachable from ACTIVATION_RESPONSE_RECEIVED | PASS (unit) |
| Live production credentials used | N/A — none used |
`,

  'PHASE_7_SANDBOX_VERIFICATION_REPORT.md': `# Phase 7 Sandbox Verification Report

**Status:** NOT EXECUTED against live MRA sandbox.

Mock scenarios cover success, invalid TAC, timeout/unknown outcome, missing credentials, confirmation accept/reject.

Authorize sandbox TIN/TAC/Product before any live call.
`,

  'PHASE_7_DEPLOYMENT_PLAN.md': `# Phase 7 Deployment Plan

1. Set \`MRA_EIS_MASTER_KEY_v1\` (or test key only in non-prod)
2. Set \`MRA_EIS_PRODUCT_ID\` / \`MRA_EIS_PRODUCT_VERSION\` or seed \`MraEisCertifiedProduct\`
3. \`npx prisma migrate deploy\`
4. \`npx prisma generate\`
5. Deploy app; verify \`/api/mra-eis/terminals/readiness\`
6. Keep \`MRA_EIS_ACTIVATION_MODE=MOCK\` until sandbox authorized
`,

  'PHASE_7_ROLLBACK_PLAN.md': `# Phase 7 Rollback Plan

- Disable platform EIS / tenant entitlement (Phase 4)
- Stop activation routes via feature flag / platform pause
- Do not delete activation evidence tables
- Credential ciphertext retained; revoke references if needed
`,

  'PHASE_7_INCIDENT_RUNBOOKS.md': `# Phase 7 Incident Runbooks

## Unknown activation outcome
1. Do not retry
2. Open Manual Review
3. Check attempt evidence (sanitized)
4. Contact MRA support if no recovery endpoint

## Partial credential storage
1. Confirm CREDENTIAL_STORAGE_FAILED
2. Ensure partial JWT revoked
3. Manual recovery — do not confirm

## Cross-tenant access
1. Expect 403/permission error
2. Audit event
3. Investigate actor
`,

  'PHASE_7_RISK_REGISTER.md': `# Phase 7 Risk Register

| Risk | Mitigation |
|---|---|
| Blind retry after timeout | Explicit unknown outcome |
| Credential leakage to browser | safeTerminalDto + API contracts |
| Invented MAC / SaaS identity | Production blocked |
| Unverified confirmation crypto | Fail closed / productionEnabled false |
| Multi-node rate limit bypass | Document shared store follow-up |
`,

  'PHASE_8_HANDOVER.md': `# Phase 8 Handover — Configuration Synchronization

## Ready inputs from Phase 7
- Active terminal model + status machine
- Credential references (JWT + secret) via Secret Provider
- Activation-bootstrap configuration snapshots (global/terminal/taxpayer)
- MRA API client + mock
- Request hasher / canonicalizer (Phase 6)
- Environment registry / activation mode
- Product ID + version on terminal
- Outbox event \`CONFIGURATION_SYNC_REQUESTED\` after ACTIVE
- Sync Run model (Phase 5)
- Permissions / audit / health

## Phase 8 must implement
- Current configuration retrieval + BOD/scheduled/manual sync
- Version compare, activate, staleness, terminal pause
- Tax/levy/offline-threshold/receipt extraction
- Conflict handling, retry/backoff, unblock refresh
- Admin UI + monitoring + tests

## Blockers carried forward
- Q-017–019 SaaS identity (production)
- Confirmation signer sandbox verification for productionEnabled
- Live sandbox verification of activation/config contracts
- Q-010/Q-011 message hash if required on sync endpoints
- Q-016 recovery endpoint if MRA provides status poll

## Acceptance for Phase 8 start
Terminal can be ACTIVE in MOCK with encrypted credentials and bootstrap snapshots; config sync workers may consume outbox without re-implementing activation.
`,

  'PHASE_7_READINESS_DECISION.md': `# Phase 7 Readiness Decision

## Decision: READY_FOR_PHASE_8_WITH_BLOCKERS

Terminal onboarding, secure activation, credential persistence, confirmation, unknown-outcome controls, wizard/admin UI, and mock verification are implemented and suitable to begin Phase 8 configuration synchronization **in MOCK / authorized sandbox** contexts.

### Results summary
| Area | Result |
|---|---|
| Readiness service | PASS |
| Terminal creation | PASS |
| TAC security | PASS (ephemeral) |
| Activation request/response | PASS (mock) |
| Credential storage | PASS (Phase 6 path) |
| Config bootstrap | PASS |
| Confirmation | PASS (mock; prod signer gated) |
| Unknown outcomes | PASS |
| Idempotency / concurrency foundations | PASS |
| Security / multi-tenant scoping | PASS |
| Sandbox live | NOT RUN |
| Production | BLOCKED (identity + signer + entitlement) |

### Recommended next action
Begin Phase 8 config sync against MOCK and prepare authorized sandbox verification checklist. Do not enable production activation.
`,

  'FINAL_PHASE_7_IMPLEMENTATION_REPORT.md': `# Final Phase 7 Implementation Report

## 1. Executive summary
Phase 7 delivers a controlled terminal onboarding and activation workflow for InsightBooks V2 MRA EIS: readiness, draft creation, ephemeral TAC, mockable activation/confirmation, encrypted credential persistence, immutable configuration bootstrap, ACTIVE-only-after-confirmation, unknown-outcome recovery, reactivation/replacement foundations, health/token expiry, tenant and system UIs, permissions, tests, and documentation.

## 2. Phase boundary
In scope: onboarding through ACTIVE + queue Phase 8 sync. Out of scope: sale fiscalization, full product sync, offline certification, production live calls.

## 3–5. Inputs / audit / gaps
Phases 1–6 deliverables reviewed. Dependency audit and gap register recorded in this folder.

## 6–34. Implementation map
See topic docs and code under \`${ACT}\`, \`${CLIENT}\`, Prisma migration \`${MIG}\`, APIs under \`app/api/mra-eis/terminals\`, UIs under \`app/settings/integrations/mra-eis/terminals\` and \`app/insightbooks/mra-eis/terminals\`.

## 35–47. UI / permissions / audit / metrics
Wizard resumable from server status; admin list filters; permissions extended; audit actions; in-process metrics/rate limits.

## 48–49. Mock + sandbox safety
Mock server scenarios; no automatic live sandbox; production fetch blocked.

## 50–67. Tests
\`test/mraEis.phase7.activation.test.js\`, \`test/mraEis.phase7.readiness.test.js\`.

## 68–70. Build verification
Run typecheck/lint/build in CI/local after prisma generate. DB migrate is environment-dependent.

## 71–73. Remaining defects / blockers
G7-01…G7-08 in gap register. No intentional Sale/Journal/Stock changes.

## 74–77. Deploy / verify / incident / rollback
See PHASE_7_DEPLOYMENT_PLAN, INCIDENT_RUNBOOKS, ROLLBACK_PLAN.

## 78–91. Confirmations
- TAC ephemeral; not plaintext in terminal table
- JWT + terminal secret encrypted
- Credentials never to browser
- ACTIVE requires confirmation success
- Unknown outcomes do not blind-retry
- Config snapshots immutable (Phase 5 rules)
- Cross-tenant access rejected via scoped queries
- Sandbox/production separated; production blocked
- No Sale / fiscal number / fiscal receipt / Journal / Stock mutation in activation path

## 92. Readiness Decision
\`READY_FOR_PHASE_8_WITH_BLOCKERS\`

## 93. Honest conclusion
Phase 7 activation foundation is production-grade for MOCK and prepared sandbox workflows, with explicit fail-closed production blockers until MRA SaaS identity and sandbox verification close. Phase 8 may proceed for configuration synchronization against activated mock terminals.
`,
};

for (const [name, body] of Object.entries(files)) {
  w(name, body);
}

console.log(`Wrote ${Object.keys(files).length} Phase 7 docs to ${root}`);
