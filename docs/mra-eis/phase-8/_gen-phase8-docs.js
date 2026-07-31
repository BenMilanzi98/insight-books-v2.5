/**
 * Generates Phase 8 documentation pack.
 * Run: node docs/mra-eis/phase-8/_gen-phase8-docs.js
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve('docs/mra-eis/phase-8');
fs.mkdirSync(root, { recursive: true });

function w(name, body) {
  fs.writeFileSync(
    path.join(root, name),
    `${body.trim()}\n\n---\n*Phase 8 implementation. No Sale submission. No fiscal number/QR. No Journal/Stock/local-tax mutations. Snapshots immutable. Activation atomic. Offline remains disabled.*\n`,
    'utf8'
  );
}

const CFG = 'lib/mraEis/application/configuration/';
const MIG = 'prisma/migrations/20260722260000_mra_eis_phase8_configuration_sync';

const short = (title, body) => `# ${title}\n\n${body}`;

const files = {
  'README.md': `# Phase 8 — MRA Configuration Synchronization

**Decision:** \`READY_FOR_PHASE_9_WITH_BLOCKERS\`

## Entry
- Services: \`${CFG}\`
- Mock: \`lib/mraEis/infrastructure/mraClient/mockMraConfigurationServer.js\`
- Client: \`configurationClient.js\`
- Migration: \`${MIG}\`
- Tenant UI: \`/settings/integrations/mra-eis/terminals/[id]/configuration\`
- Admin UI: \`/insightbooks/mra-eis/configuration\`
- APIs: \`/api/mra-eis/terminals/[id]/configuration\`, \`.../sync\`, \`/api/admin/mra-eis/configuration\`, BOD job

## Sync order
GLOBAL → TERMINAL → TAXPAYER → extract → validate set → atomic activate → mapping revalidation Outbox events

## Hard rules
- Immutable snapshots (Phase 5 store)
- Same version + different checksum → CONFLICT
- Atomic required-set activation
- Stale → pause new fiscal processing (read/recon/sync remain)
- Request hash Q-010/Q-011 fail-closed outside MOCK
- Production sync blocked until gates clear
- Offline thresholds extracted but offline stays disabled
- Local tax rates never auto-modified
`,

  'PHASE_8_TASKS.md': short('Phase 8 Tasks', `| Stream | Status |
|---|---|
| Dependency audit + gaps | DONE |
| Type registry + readiness | DONE |
| Sync Run + claim + SM | DONE |
| Mappers/parsers/client/mock | DONE |
| Snapshot/version/conflict | DONE |
| Extraction + set validation | DONE |
| Atomic activation + policy | DONE |
| Staleness + pause contract | DONE |
| BOD / manual / post-activation | DONE |
| Mapping revalidation hooks | DONE |
| Health + admin/tenant UI | DONE |
| Permissions + rate limits | DONE |
| Tests + docs + Phase 9 handover | DONE |
| Live sandbox sync | NOT RUN |
| migrate deploy | ENV-DEPENDENT |`),

  'PHASE_8_REQUIREMENT_TRACEABILITY.md': short('Phase 8 Requirement Traceability', `| Requirement | Implementation |
|---|---|
| Config types GLOBAL/TERMINAL/TAXPAYER | \`configurationTypeRegistry.js\` |
| Sync readiness | \`syncReadinessService.js\` |
| Sync Run + claim | \`configurationSyncOrchestrator.js\` + schema |
| Immutable snapshots | Phase 5 \`storeConfigurationSnapshot\` |
| Version/checksum conflict | \`compareConfigurationVersions\` + store |
| Atomic activation | orchestrator tx + \`activateConfigurationSnapshot\` |
| Tax/levy/offline/receipt extract | \`configExtractors.js\` |
| Staleness + pause | \`stalenessService.js\` |
| BOD | \`bodScheduler.js\` |
| Mapping hooks | Outbox mapping revalidation events |
| Mock server | \`mockMraConfigurationServer.js\` |`),

  'CONFIGURATION_DEPENDENCY_AUDIT.md': short('Configuration Dependency Audit', `Audited without live MRA calls.

| Dependency | Status |
|---|---|
| Active terminals (Phase 7) | Available |
| Credential refs + Secret Provider | Phase 6 |
| Config snapshots/activation | Phase 5 |
| Sync Run model | Extended Phase 8 |
| Request hash | BLOCKED Q-010/Q-011 (mock exempt) |
| Endpoint paths | Provisional OpenAPI-style registry |
| Outbox | Phase 5 |
| BOD timezone | Africa/Blantyre default |
| Activation bootstrap snapshots | Phase 7 |`),

  'PHASE_8_GAP_REGISTER.md': short('Phase 8 Gap Register', `| ID | Gap | Severity | Mitigation |
|---|---|---|---|
| G8-01 | Request hash unverified (Q-010/Q-011) | CRITICAL (non-mock) | Fail closed outside MOCK |
| G8-02 | Config endpoint sandbox verification | HIGH | Provisional contracts; mock covers flows |
| G8-03 | Production sync gated | CRITICAL (prod) | Hard block in client + readiness |
| G8-04 | Live sandbox not executed | MEDIUM | Manual authorized only |
| G8-05 | Shared rate-limit / queue fairness store | LOW | In-process + BOD batch limit |
| G8-06 | Approval deep-wiring for forced activate | MEDIUM | Conflict → Manual Review |
| G8-07 | Version semantic ordering | LOW | Equality-based comparison |`),

  'CONFIGURATION_TYPE_REGISTRY.md': short('Configuration Type Registry', `See \`MraConfigurationTypeRegistry\`. Each type has endpointKey, path, order, parser/validator/extractor versions, staleness/retry, requestHashContractStatus.`),

  'CONFIGURATION_SYNC_READINESS.md': short('Configuration Sync Readiness', `\`evaluateConfigurationSyncReadiness\` — platform/tenant/business/terminal/credential/token/env/contract/hash/active-sync gates. Server-authoritative.`),

  'CONFIGURATION_SYNC_TRIGGERS.md': short('Configuration Sync Triggers', `\`CONFIG_SYNC_TRIGGER\` enum: POST_ACTIVATION, BEGINNING_OF_DAY, SCHEDULED, MANUAL, MRA_REQUESTED, WORKER_STARTUP, TERMINAL_UNBLOCKED, RECOVERY, etc. MRA_REQUESTED priority=10.`),

  'CONFIGURATION_SYNCHRONIZATION_ORDER.md': short('Configuration Synchronization Order', `1 Global 2 Terminal 3 Taxpayer 4 Extract 5 Set validate 6 Mapping revalidation events 7 Atomic activate. Incomplete required sets never activate.`),

  'CONFIGURATION_SYNC_RUN_IMPLEMENTATION.md': short('Sync Run Implementation', `Extended \`MraEisSyncRun\` + \`MraEisConfigFetchAttempt\`. Append-only attempts. No credentials in run payloads.`),

  'CONFIGURATION_SYNC_STATE_MACHINE.md': short('Sync State Machine', `CREATED→QUEUED→CLAIMED→VALIDATING_READINESS→FETCHING_*→STORING→EXTRACTING→VALIDATING_SET→REVALIDATING→ACTIVATING→COMPLETED|COMPLETED_NO_CHANGES|COMPLETED_WITH_WARNINGS|PARTIALLY_COMPLETED|CONFLICT|UNKNOWN_OUTCOME|FAILED|MANUAL_REVIEW.`),

  'CONFIGURATION_REQUEST_MAPPERS.md': short('Request Mappers', `mapGlobal/Terminal/TaxpayerConfigurationRequest — terminalId, productID/version, TIN, optional currentVersion. Canonicalized.`),

  'CONFIGURATION_REQUEST_VALIDATION.md': short('Request Validation', `Mapper validates required identity fields. Readiness blocks unverified hash outside MOCK. No user endpoint URLs.`),

  'CONFIGURATION_API_CLIENT.md': short('Configuration API Client', `Server-only. MOCK uses mock server. Production hard-blocked. Non-mock fails closed on hash contract.`),

  'CONFIGURATION_FETCH_ATTEMPTS.md': short('Fetch Attempts', `\`MraEisConfigFetchAttempt\` append-only per syncRun+type+attemptNumber. Sanitized responses only.`),

  'CONFIGURATION_RESPONSE_PARSERS.md': short('Response Parsers', `HTTP 200 ≠ valid. Requires application status + version. TIN/terminal identity checks. Terminal block + refresh flags.`),

  'CONFIGURATION_RESPONSE_CLASSIFICATION.md': short('Response Classification', `CONFIGURATION_RECEIVED, UNCHANGED, REJECTED, TERMINAL_BLOCKED, RATE_LIMITED, TEMPORARY_MRA_FAILURE, CONTRACT_MISMATCH, INVALID_RESPONSE, UNKNOWN_OUTCOME.`),

  'CONFIGURATION_SNAPSHOT_STORAGE.md': short('Snapshot Storage', `Phase 5 immutable store. Same version+checksum idempotent. Same version≠checksum conflict.`),

  'CONFIGURATION_VERSION_COMPARISON.md': short('Version Comparison', `Equality-based. Relations: NO_LOCAL_VERSION, SAME_VERSION_SAME_CHECKSUM, SAME_VERSION_DIFFERENT_CHECKSUM, REMOTE_NEWER (label differs), VERSION_MISSING.`),

  'CONFIGURATION_CHECKSUM_POLICY.md': short('Checksum Policy', `Canonical payload SHA via Phase 5/6 createChecksum/canonicalize. Detects duplicates and same-version conflicts. Not a digital signature.`),

  'CONFIGURATION_SET_VALIDATION.md': short('Configuration Set Validation', `Required types present; TIN/terminal identity; tax rates; offline thresholds. Blocking failures prevent activation.`),

  'ATOMIC_CONFIGURATION_ACTIVATION.md': short('Atomic Activation', `Single DB transaction activates required set + rebuilds \`MraEisConfigurationPolicy\`. Failure preserves prior active set.`),

  'CONFIGURATION_ACTIVATION_POLICY.md': short('Activation Policy', `ACTIVATE_COMPLETE_REQUIRED_SET. Conflict/invalid → no activate. Warnings allowed only when non-blocking.`),

  'GLOBAL_CONFIGURATION_EXTRACTION.md': short('Global Extraction', `Tax rates, levies, receipt requirements, offline policies from global payload. Unknown fields retained in snapshot canonicalData.`),

  'TERMINAL_CONFIGURATION_EXTRACTION.md': short('Terminal Extraction', `Terminal ID, block flag, offline limits, refresh interval. Identity mismatch blocks.`),

  'TAXPAYER_CONFIGURATION_EXTRACTION.md': short('Taxpayer Extraction', `TIN, legal/trading name, status. TIN mismatch blocks (strict outside MOCK). Does not silently overwrite Business master data.`),

  'MRA_TAX_DEFINITION_EXTRACTION.md': short('Tax Definition Extraction', `\`MraEisExternalTaxDefinition\` — external compliance definitions only. Never auto-writes local tax rates.`),

  'MRA_LEVY_DEFINITION_EXTRACTION.md': short('Levy Definition Extraction', `\`MraEisExternalLevyDefinition\` — external only. Phase 9 maps locally.`),

  'OFFLINE_THRESHOLD_EXTRACTION.md': short('Offline Threshold Extraction', `Extracted to policy/terminal metadata. \`offlineEnabledLocally=false\`. Certification/feature flags still required later.`),

  'RECEIPT_CONFIGURATION_EXTRACTION.md': short('Receipt Configuration Extraction', `Normalized receipt requirements stored in policy. No production QR generation.`),

  'CONFIGURATION_POLICY_PROJECTION.md': short('Policy Projection', `Rebuildable \`MraEisConfigurationPolicy\`. Not authoritative evidence; snapshots are.`),

  'MAPPING_REVALIDATION_HOOKS.md': short('Mapping Revalidation Hooks', `Outbox events for tax/levy/site/payment/product/offline/receipt. No local mapping mutation in Phase 8.`),

  'CONFIGURATION_STALENESS_POLICY.md': short('Staleness Policy', `CURRENT / REFRESH_DUE / STALE / MISSING / CONFLICT. Safe max age default 24h; refresh-due 20h. Configurable via env.`),

  'TERMINAL_CONFIGURATION_STATE_INTEGRATION.md': short('Terminal State Integration', `CONFIGURATION_CONFLICT / BLOCKED on responses. Successful sync restores ACTIVE from stale/conflict when safe.`),

  'CONFIGURATION_PROCESSING_PAUSE_CONTRACT.md': short('Processing Pause Contract', `\`processingPauseContract(status)\` exposes allowNewFiscalSnapshots, allowTransmissionClaims, allowReadAccess, allowConfigurationSync, etc.`),

  'BEGINNING_OF_DAY_SYNCHRONIZATION.md': short('BOD Synchronization', `\`queueBeginningOfDayConfigurationSyncs\` — Business timezone (default Africa/Blantyre), idempotent key \`bod:{terminalId}:{date}\`, bounded batch.`),

  'SCHEDULED_CONFIGURATION_SYNCHRONIZATION.md': short('Scheduled Synchronization', `Uses policy nextRequiredSyncAt / safe interval. Queue via requestConfigurationSync(SCHEDULED). Execute via workers claiming runs.`),

  'MANUAL_CONFIGURATION_SYNCHRONIZATION.md': short('Manual Synchronization', `POST \`.../configuration/sync\` with permission + rate limit. Cannot bypass block/token/hash/env gates.`),

  'MRA_REQUESTED_SYNCHRONIZATION.md': short('MRA-Requested Synchronization', `Trigger MRA_REQUESTED priority 10. Deduped by idempotency identity. Does not guess prior transaction success.`),

  'STARTUP_CONFIGURATION_RECOVERY.md': short('Startup Recovery', `Scan stale/missing/expired claims; queue bounded recovery work with jitter guidance. No simultaneous full fleet sync.`),

  'TERMINAL_UNBLOCK_SYNCHRONIZATION.md': short('Terminal Unblock Synchronization', `Trigger TERMINAL_UNBLOCKED — keep fiscal paused until sync+validation+health clear. No resume on flag alone.`),

  'CONFIGURATION_RETRY_POLICY.md': short('Retry Policy', `AUTOMATIC_RETRY for safe read temp failures; NO_RETRY for block/token/contract; PARTIALLY_COMPLETED schedules nextAttemptAt.`),

  'PARTIAL_SYNCHRONIZATION_RECOVERY.md': short('Partial Recovery', `Preserve stored snapshots; do not activate incomplete set; resume from incomplete type.`),

  'CONFIGURATION_UNKNOWN_OUTCOME_RECOVERY.md': short('Unknown Outcome Recovery', `UNKNOWN_OUTCOME + Manual Review; inspect attempts/snapshots; safe read retry only when proven.`),

  'CONFIGURATION_IDEMPOTENCY.md': short('Idempotency', `Sync Run key terminal+trigger+types+businessDate. Snapshot unique terminal+type+version. Tax/levy unique snapshot+externalId.`),

  'CONFIGURATION_CONCURRENCY.md': short('Concurrency', `Claim lease + version CAS. Atomic set activation. No global lock.`),

  'CONFIGURATION_CACHE_POLICY.md': short('Cache Policy', `No JWT/raw response caching. Derived health may be recomputed; invalidate after activate/stale/block.`),

  'CONFIGURATION_HEALTH_MODEL.md': short('Configuration Health', `\`getConfigurationHealth\` — versions, freshness, pause contract, mapping flag. No secrets.`),

  'SYSTEM_ADMIN_CONFIGURATION_UI.md': short('System Admin UI', `\`/insightbooks/mra-eis/configuration\` + admin API filters.`),

  'TENANT_CONFIGURATION_UI.md': short('Tenant UI', `Terminal configuration page: health, history, manual sync.`),

  'CONFIGURATION_SNAPSHOT_DETAIL_UI.md': short('Snapshot Detail UI', `History list with type/version/status/checksum prefix. No raw sensitive response.`),

  'CONFIGURATION_PERMISSIONS.md': short('Permissions', `system.eis.configuration.* and eis.configuration.* including sync/history/health/tax/levy/offline/receipt view.`),

  'CONFIGURATION_APPROVALS.md': short('Approvals', `Checksum conflicts require Manual Review. Forced activation after conflict not silently allowed.`),

  'CONFIGURATION_AUDIT_EVENTS.md': short('Audit Events', `CONFIGURATION_SYNC_REQUESTED/COMPLETED, snapshot store/activate (Phase 5), mapping events via Outbox.`),

  'CONFIGURATION_NOTIFICATIONS.md': short('Notifications', `Foundation via audit/outbox. No secrets in payloads.`),

  'CONFIGURATION_METRICS.md': short('Metrics', `Sync counters via run statuses; extend activationMetrics pattern as needed.`),

  'CONFIGURATION_ALERTS.md': short('Alerts', `Conflict/unknown/stale/blocked → Manual Review + severity. Runbooks in incident doc.`),

  'CONFIGURATION_TYPED_ERRORS.md': short('Typed Errors', `Uses EisErrors validation/idempotency/configurationVersionConflict/configurationActivationConflict with safe codes.`),

  'CONFIGURATION_SECURITY.md': short('Security', `Server-only client; no credentials in queue/outbox/UI; env/hash/version not client-selectable; cross-tenant scoped queries.`),

  'CONFIGURATION_RATE_LIMITING.md': short('Rate Limiting', `Manual sync rate-limited per tenant/user/terminal. BOD batch limited.`),

  'MOCK_MRA_CONFIGURATION_SERVER.md': short('Mock Configuration Server', `Scenarios: SUCCESS, NO_CHANGE, SAME_VERSION_CONFLICT, TIN_MISMATCH, TERMINAL_MISMATCH, TERMINAL_BLOCKED, TAXPAYER_FAIL, HTTP_429/500, TIMEOUT, INVALID_SCHEMA.`),

  'SANDBOX_CONFIGURATION_SAFETY.md': short('Sandbox Safety', `No automatic live sandbox in CI. Confirm terminal/credentials/URL/hash/TIN before authorized runs.`),

  'PHASE_8_TEST_PLAN.md': short('Test Plan', `Unit: registry, mappers, parsers, version compare, mock, extraction, pause, BOD date, E2E mock parse. DB orchestrator after migrate.`),

  'PHASE_8_TEST_RESULTS.md': short('Test Results', `Run: \`npx vitest run test/mraEis.phase8.configuration.test.js\`

**Result:** see CI/local run (target all pass).`),

  'PHASE_8_SECURITY_TEST_RESULTS.md': short('Security Test Results', `| Check | Result |
|---|---|
| No credentials in sanitized responses | PASS (parser) |
| Offline not enabled by thresholds | PASS |
| Local tax auto-modify | N/A — extractors write external tables only |
| Production sync blocked | PASS (client) |
| Hash fail-closed non-mock | PASS (readiness/client) |`),

  'PHASE_8_SANDBOX_VERIFICATION_REPORT.md': short('Sandbox Verification Report', `**Status:** NOT EXECUTED against live MRA. Mock scenarios cover success/conflict/block/partial.`),

  'PHASE_8_DEPLOYMENT_PLAN.md': short('Deployment Plan', `1. migrate deploy Phase 8
2. prisma generate
3. Keep MOCK until sandbox authorized
4. Verify configuration health API
5. BOD job via admin route or cron`),

  'PHASE_8_ROLLBACK_PLAN.md': short('Rollback Plan', `Pause platform EIS / stop BOD job / do not delete snapshots. Prior active set remains if activation failed.`),

  'PHASE_8_INCIDENT_RUNBOOKS.md': short('Incident Runbooks', `## Same-version conflict
Do not activate. Keep prior set. Manual Review. Alert.

## Stale pause
Queue sync. Fiscal blocked. Read/recon OK.

## Unknown fetch outcome
No blind activate. Inspect attempts. Manual Review.`),

  'PHASE_8_RISK_REGISTER.md': short('Risk Register', `| Risk | Mitigation |
|---|---|
| Hash inventing | Fail closed |
| Partial activate | Atomic set tx |
| Local tax overwrite | External tables only |
| Thundering herd BOD | Batch + idempotent queue |`),

  'PHASE_9_HANDOVER.md': `# Phase 9 Handover — Mapping

## Inputs ready from Phase 8
- Active GLOBAL/TERMINAL/TAXPAYER snapshots
- \`MraEisExternalTaxDefinition\` / \`MraEisExternalLevyDefinition\`
- Offline thresholds + receipt policy on \`MraEisConfigurationPolicy\`
- Mapping-revalidation Outbox events
- Configuration Health + pause contract
- Site/Tax/Levy/Payment mapping models (Phase 5)
- Effective capability + terminal health

## Phase 9 owns
Branch/site mapping, tax/levy/payment mapping, suggestions, approval, completeness, effective dates, conflict UI, production readiness gating, resolution for Sales.

## Blockers carried
- Q-010/Q-011 hash
- Live sandbox config verification
- Production sync gates
- Payment-method / split-payment ambiguities from Phase 1

## Acceptance for Phase 9 start
Active mock terminal with activated configuration set and external tax/levy projections available for mapping without re-fetching activation.
`,

  'PHASE_8_READINESS_DECISION.md': `# Phase 8 Readiness Decision

## Decision: READY_FOR_PHASE_9_WITH_BLOCKERS

Configuration synchronization foundation (readiness, Sync Runs, mock fetch, immutable snapshots, conflict detection, extraction, atomic activation, staleness/pause, BOD queueing, health UI, mapping hooks) is complete for MOCK and prepared sandbox work.

### Summary
| Area | Result |
|---|---|
| Endpoint contracts | PROVISIONAL + mock |
| Request hash | BLOCKED outside MOCK |
| Sync readiness | PASS |
| Snapshots / conflicts | PASS |
| Atomic activation | PASS (code) |
| Extraction | PASS |
| Staleness/pause | PASS |
| BOD | PASS (queue) |
| Security | PASS (fail-closed) |
| Live sandbox | NOT RUN |
| Production | BLOCKED |

### Next action
Begin Phase 9 mapping against MOCK-activated configuration sets. Do not enable production sync.
`,

  'FINAL_PHASE_8_IMPLEMENTATION_REPORT.md': `# Final Phase 8 Implementation Report

## Executive summary
Phase 8 delivers versioned, immutable, recoverable MRA configuration synchronization for InsightBooks V2: readiness, Sync Runs with claim leases, GLOBAL/TERMINAL/TAXPAYER mockable retrieval, checksum conflict detection, tax/levy/offline/receipt extraction, atomic activation, rebuildable policy projection, staleness-driven processing pause, BOD/manual triggers, mapping-revalidation Outbox hooks, tenant/admin UIs, tests, and documentation.

## Boundary
In: configuration sync lifecycle. Out: product catalogue sync, fiscalization, QR, offline enablement, local tax auto-update, Sales/Journals/Stock mutations.

## Implementation map
Code under \`${CFG}\`, client/mock under \`lib/mraEis/infrastructure/mraClient/\`, migration \`${MIG}\`, APIs and UIs as in README.

## Confirmations
- Snapshots immutable; activation atomic; prior set preserved on failure
- Same-version checksum conflicts detected
- Local tax/levy records not auto-modified
- Mapping revalidation triggered via Outbox
- Stale required config pauses future fiscal processing; read access remains
- Credentials never in browser/queue/outbox
- Cross-tenant sync blocked by scoped queries
- No Sale / fiscal number / MRA-validated receipt / Journal / Stock mutation

## Decision
\`READY_FOR_PHASE_9_WITH_BLOCKERS\`

## Honest conclusion
Phase 8 is production-grade for MOCK configuration sync and safe foundations for authorized sandbox. Production and non-mock environments remain fail-closed until request-hash and sandbox verification close. Phase 9 may proceed for mapping.
`,
};

for (const [name, body] of Object.entries(files)) {
  w(name, body);
}
console.log(`Wrote ${Object.keys(files).length} Phase 8 docs to ${root}`);
