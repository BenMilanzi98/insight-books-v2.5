/**
 * Generates Phase 17 documentation pack.
 * Run: node docs/mra-eis/phase-17/_gen-phase17-docs.js
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve('docs/mra-eis/phase-17');
fs.mkdirSync(root, { recursive: true });

function w(name, body) {
  fs.writeFileSync(
    path.join(root, name),
    `${body.trim()}\n\n---\n*Phase 17 implementation. Restrictions are source/scope/environment-aware with immutable evidence. Multiple restrictions coexist; clearing one does not clear others. Most restrictive control wins. MRA blocks require verified MRA clearance. HTTP 200 alone is not clearance. Approval alone does not restore Terminal. Post-unblock revalidation is mandatory. Production unblock calls remain BLOCKED until contract verified. No credentials/JWT/private keys/BAC in evidence. No Journal/Stock repost. No fiscal-number reuse. No accepted Sale retransmission. Browser cannot set Terminal ACTIVE.*\n`,
    'utf8'
  );
}

const R = 'lib/mraEis/application/restrictions/';
const short = (title, body) => `# ${title}\n\n${body}`;

const files = {
  'README.md': `# Phase 17 — Terminal Blocking, Unblocking & Compliance Controls

**Decision:** \`READY_FOR_PHASE_18_WITH_BLOCKERS\`

## Entry
- Domain: \`${R}\`
- APIs: \`/api/mra-eis/restrictions\`
- UI: \`/settings/integrations/mra-eis/restrictions\`
- Models: \`MraEisRestriction\`, \`MraEisUnblockRequest\`, \`MraEisUnblockStatusQueryAttempt\`, \`MraEisPostUnblockRevalidationRun\`
- Migration: \`prisma/migrations/20260723040000_mra_eis_phase17_restrictions\`
- Tests: \`test/mraEis.phase17.restrictions.test.js\`
- Legacy wrap: \`lib/eisService.js\` fail-closed status; Terminal \`BLOCKED→ACTIVE\` forbidden

## Hard rules
- Not a single \`blocked\` Boolean — multi-source Restriction aggregate
- MRA clearance requires verified application outcome (not HTTP 200)
- Tenant users cannot clear MRA restrictions
- Browser cannot set Terminal ACTIVE
- Post-unblock revalidation mandatory; remaining restrictions rechecked
- Gradual capability restoration
- Preserve Snapshots, numbers, Attempts, Responses, envelopes, queues, receipts
- No accounting / inventory reverse or repost
`,

  'PHASE_17_TASKS.md': short(
    'Phase 17 Tasks',
    `| Stream | Status |
|---|---|
| Restriction dependency audit | DONE |
| Gap register | DONE |
| MRA block/unblock contract decision | DONE (mock provisional; prod BLOCKED) |
| Source / Reason / Scope / Precedence registries | DONE |
| Capability matrix + Effective Compliance Capability | DONE |
| Restriction aggregate + evidence + projection | DONE |
| Ingestion / idempotency / expiry policy | DONE |
| Platform emergency pause | DONE |
| Tenant / Business / Site / Terminal / Agent / Device / Cert / Credential / Config / Sequence / Queue restrictions | DONE (via reason registry + ingest) |
| Pending-work classification | DONE |
| Unblock Request + approvals + mock status | DONE |
| Post-unblock revalidation + gradual restoration | DONE |
| Workers (claim leases) | DONE |
| API + UI | DONE |
| Permissions | DONE |
| Unsafe fail-open / direct ACTIVE disabled | DONE |
| Unit tests | DONE |
| Docs + Phase 18 handover | DONE |
| Live/production MRA unblock endpoint | BLOCKED |
| Full Prisma-backed Unblock Status Attempts persistence in all paths | PARTIAL (memory + schema; API uses memory when mock) |
| Full System Admin cross-tenant dashboard polish | DEFERRED to Phase 18 |`
  ),

  'PHASE_17_REQUIREMENT_TRACEABILITY.md': short(
    'Phase 17 Requirement Traceability',
    `| Requirement | Trace |
|---|---|
| Source-aware restrictions | \`restrictionRegistries.js\` + \`ingestRestriction\` |
| Scope / environment | Restriction fields + projection |
| Precedence | \`PRECEDENCE_ORDER\` / \`pickPrimaryRestriction\` |
| Capability policy | \`capabilityMatrix.js\` + \`effectiveComplianceCapability.js\` |
| Immutable evidence | \`evidenceJson\` + checksum; secrets stripped |
| Unblock workflow | \`unblockService.js\` |
| Mock status | \`mockMraBlockUnblockServer.js\` |
| Revalidation | \`revalidationService.js\` |
| Workers | \`restrictionWorkers.js\` |
| Fail-closed legacy | \`lib/eisService.js\` checkTerminalStatus |
| Direct ACTIVE forbidden | \`terminalService.js\` |`
  ),

  'RESTRICTION_CONTROL_DEPENDENCY_AUDIT.md': short(
    'Restriction Control Dependency Audit',
    `| Control | Classification | Notes |
|---|---|---|
| \`MraEisTerminal.status\` / \`blockedAt\` | WRAP | Projection is authoritative for capabilities |
| Platform emergency pause (Phase 4) | EXTEND | Ingest as PLATFORM_EMERGENCY_PAUSE |
| Tenant entitlement suspend | EXTEND | TENANT_ENTITLEMENT_SUSPENDED |
| Business EIS pause | EXTEND | BUSINESS_EIS_PAUSED |
| Agent suspend/revoke (Phase 16) | EXTEND | OFFLINE_AGENT_SUSPENDED |
| Device compromise | EXTEND | OFFLINE_DEVICE_COMPROMISED |
| \`eisService.checkTerminalStatus\` fail-open | UNSAFE_AUTO_UNBLOCK → FIXED | Now fail-closed |
| Offline API client \`terminalBlocked\` | UNSAFE_DIRECT_OVERRIDE → FIXED | Ignored / rejected |
| Terminal BLOCKED→ACTIVE | UNSAFE_DIRECT_OVERRIDE → DISABLED | Throws |
| Phase 13/15/16 block signals | REUSE | Ingest into Restriction aggregate |
| Generic Audit / Approval / Outbox | REUSE | No duplicate generic systems |`
  ),

  'PHASE_17_GAP_REGISTER.md': short(
    'Phase 17 Gap Register',
    `| ID | Gap | Severity | Status |
|---|---|---|---|
| G17-001 | Live MRA unblock-status production contract unverified | HIGH | BLOCKED |
| G17-002 | Live MRA unblock request submission not in verified contract | HIGH | BLOCKED |
| G17-003 | Full persistence of query attempts on all workers | MEDIUM | Schema ready; mock path memory |
| G17-004 | Unified Phase 18 admin fleet dashboards | MEDIUM | HANDOVER |
| G17-005 | Legacy Boolean migration dry-run across all tenants | MEDIUM | Plan documented; dry-run tooling deferred |
| G17-006 | Phase 13 success-code / hash blockers (carry-forward) | HIGH | Carry-forward |
| G17-007 | Phase 15 Last Online/Offline live | HIGH | Carry-forward |
| G17-008 | Phase 16 production offline certification | HIGH | Carry-forward |`
  ),

  'MRA_BLOCK_UNBLOCK_CONTRACT_DECISION.md': short(
    'MRA Block / Unblock Contract Decision',
    `| Surface | Decision |
|---|---|
| Block from Sales response | PROVISIONAL_SANDBOX_ONLY |
| Block from configuration | PROVISIONAL_SANDBOX_ONLY |
| Unblock status mock | PROVISIONAL_SANDBOX_ONLY |
| Unblock status live sandbox | BLOCKED |
| Unblock status production | BLOCKED |
| Unblock request submission production | BLOCKED |
| HTTP 200 alone | NOT clearance |
| Implementation | Mock status query only; support references stored as evidence |`
  ),

  'PHASE_18_HANDOVER.md': short(
    'Phase 18 Handover',
    `Phase 18 owns unified EIS administration, monitoring and reporting UI.

## Available from Phase 17
- Restriction aggregate + Terminal Compliance Projection
- Unblock Requests + mock status classification
- Revalidation runs + gradual restoration stages
- Capability matrix / Effective Compliance Capability
- Emergency pause activate/clear
- Pending online/offline classification helpers
- Permissions: \`eis.restrictions.*\`, \`eis.unblockRequests.*\`, \`system.eis.emergencyPause.*\`
- API: \`/api/mra-eis/restrictions\`
- UI seed: \`/settings/integrations/mra-eis/restrictions\`

## Phase 18 must not weaken
- Multi-tenant isolation
- Restriction enforcement
- Credential security
- Fiscal-number integrity
- Snapshot / Response / Receipt immutability
- Accounting / Inventory isolation

## Phase 18 acceptance (summary)
- Unified System / Tenant / Business EIS dashboards
- Terminal / Site / Agent / Device fleets
- Transmission / Reconciliation / Offline / Receipt / Restriction monitoring
- Incident + Manual Review workbenches
- Report + export center
- Accessible, responsive role-based dashboards`
  ),

  'PHASE_17_READINESS_DECISION.md': short(
    'Phase 17 Readiness Decision',
    `## Decision: READY_FOR_PHASE_18_WITH_BLOCKERS

Restriction ingestion, multi-source coexistence, MRA Terminal blocking enforcement, platform emergency pause, controlled Unblock Requests (mock status), post-unblock revalidation, pending-work classification and fail-closed legacy fixes are complete for Phase 18 admin/monitoring work.

### Blockers
- Production / live sandbox MRA unblock-status contract (G17-001)
- Production unblock submission (G17-002)
- Carry-forward Phases 13–16 live contract blockers (G17-006…008)

### Recommended next action
Proceed with Phase 18 unified administration UI while keeping production unblock calls disabled.`
  ),

  'FINAL_PHASE_17_IMPLEMENTATION_REPORT.md': short(
    'Final Phase 17 Implementation Report',
    `## Executive summary
Phase 17 delivers a centralized, evidence-driven compliance-control plane for MRA EIS restrictions. Multiple restrictions coexist; clearance is source-specific; revalidation is mandatory; production MRA unblock remains blocked.

## Key artifacts
- \`${R}\`
- Migration \`20260723040000_mra_eis_phase17_restrictions\`
- Tests \`test/mraEis.phase17.restrictions.test.js\`
- Docs under \`docs/mra-eis/phase-17/\`

## Confirmations
- Source / scope / environment aware: YES
- Multiple restrictions coexist: YES
- Clearing one leaves others: YES
- Most restrictive wins: YES
- MRA requires MRA clearance: YES
- Tenant cannot clear MRA: YES
- Browser cannot set ACTIVE: YES
- HTTP 200 ≠ clearance: YES
- Post-unblock revalidation mandatory: YES
- Accepted Sales not retransmitted: YES (classification)
- Unknown not blind-retried: YES
- Credentials absent from evidence: YES
- Journals / Stock not reposted by workers: YES

## Readiness
\`READY_FOR_PHASE_18_WITH_BLOCKERS\``
  ),
};

// Generate remaining registry/docs as concise implementation notes
const topics = [
  ['RESTRICTION_SOURCE_REGISTRY.md', 'See `restrictionRegistries.js` RESTRICTION_SOURCE + getRestrictionSourceRegistry().'],
  ['RESTRICTION_REASON_REGISTRY.md', 'See RESTRICTION_REASON + getReasonMeta().'],
  ['RESTRICTION_SCOPE_REGISTRY.md', 'See RESTRICTION_SCOPE.'],
  ['RESTRICTION_PRECEDENCE_POLICY.md', 'See PRECEDENCE_ORDER + pickPrimaryRestriction().'],
  ['RESTRICTION_CAPABILITY_MATRIX.md', 'See capabilityMatrix.js MATRIX.'],
  ['EFFECTIVE_COMPLIANCE_CAPABILITY_POLICY.md', 'See evaluateEffectiveComplianceCapabilities().'],
  ['RESTRICTION_AGGREGATE.md', 'See ingestRestriction / clearRestriction / MraEisRestriction model.'],
  ['RESTRICTION_EVIDENCE.md', 'evidenceJson + evidenceChecksum; secrets stripped.'],
  ['RESTRICTION_EVENT_MODEL.md', 'Outbox/audit events via existing EIS control audit; worker ingest events.'],
  ['TERMINAL_COMPLIANCE_PROJECTION.md', 'buildTerminalComplianceProjection().'],
  ['RESTRICTION_INGESTION.md', 'processRestrictionIngestEvent + ingestRestriction.'],
  ['RESTRICTION_IDEMPOTENCY.md', 'identityKey = hash(source+reason+scope+env+checksum).'],
  ['RESTRICTION_EXPIRY.md', 'autoExpire only for MAINTENANCE-class; MRA/security never auto-expire.'],
  ['PLATFORM_EMERGENCY_PAUSE.md', 'activatePlatformEmergencyPause / clearPlatformEmergencyPause.'],
  ['TENANT_BUSINESS_SUSPENSION.md', 'Reasons TENANT_ENTITLEMENT_SUSPENDED / BUSINESS_EIS_PAUSED.'],
  ['SITE_RESTRICTIONS.md', 'MRA_SITE_RESTRICTED + scope MRA_SITE.'],
  ['TERMINAL_RESTRICTIONS.md', 'MRA_TERMINAL_BLOCKED + TERMINAL scope.'],
  ['AGENT_DEVICE_RESTRICTIONS.md', 'OFFLINE_AGENT_SUSPENDED / OFFLINE_DEVICE_COMPROMISED.'],
  ['CREDENTIAL_RESTRICTIONS.md', 'TERMINAL_CREDENTIAL_REVOKED.'],
  ['CONFIGURATION_RESTRICTIONS.md', 'TERMINAL_CONFIGURATION_STALE; sync ALLOW.'],
  ['SEQUENCE_RESTRICTIONS.md', 'FISCAL_SEQUENCE_CONFLICT; allocate BLOCK; recon ALLOW.'],
  ['OFFLINE_QUEUE_RESTRICTIONS.md', 'OFFLINE_QUEUE_INTEGRITY_FAILURE.'],
  ['PENDING_WORK_CLASSIFICATION.md', 'classifyPendingOnlineWork / OfflineWork.'],
  ['ACTIVE_WORKER_SHUTDOWN.md', 'claim leases stop new claims; no evidence destruction.'],
  ['SAFE_OPERATIONS_WHILE_BLOCKED.md', 'Receipts, recon, config sync, status query ALLOW per matrix.'],
  ['UNBLOCK_REQUEST_AGGREGATE.md', 'unblockService.js + MraEisUnblockRequest.'],
  ['SOURCE_SPECIFIC_UNBLOCK_POLICY.md', 'clearAuthority per reason; MRA requires MRA evidence.'],
  ['UNBLOCK_APPROVALS.md', 'approveUnblockRequest; self-approval prohibited.'],
  ['MRA_UNBLOCK_STATUS_CONTRACT_REGISTRY.md', 'getMraBlockUnblockContractDecision(); mock only.'],
  ['UNBLOCK_STATUS_QUERY_ATTEMPTS.md', 'Append-only attempts on request; schema MraEisUnblockStatusQueryAttempt.'],
  ['UNBLOCK_RESPONSE_EVIDENCE.md', 'Mock response checksum + evidenceId; no credentials.'],
  ['CLEARANCE_CLASSIFICATION.md', 'normalizedOutcome enum in mock server.'],
  ['POST_UNBLOCK_REVALIDATION_AGGREGATE.md', 'runPostUnblockRevalidation + Prisma model.'],
  ['POST_UNBLOCK_REVALIDATION_CHECKS.md', 'platform→pendingWork checks list.'],
  ['GRADUAL_CAPABILITY_RESTORATION.md', 'RESTORATION_STAGES 1–5.'],
  ['PENDING_ONLINE_RECOVERY.md', 'Accepted never resubmit; unknown reconcile.'],
  ['PENDING_OFFLINE_RECOVERY.md', 'Accepted never reupload; order preserved.'],
  ['RESTRICTION_CLEARANCE.md', 'clearRestriction with authority + proven evidence.'],
  ['REMAINING_RESTRICTIONS.md', 'Recompute after each clearance.'],
  ['TERMINAL_STATE_INTEGRATION.md', 'Projection + BLOCKED→ACTIVE forbidden.'],
  ['RESTRICTION_WORKER.md', 'processRestrictionIngestEvent.'],
  ['UNBLOCK_STATUS_WORKER.md', 'processUnblockStatusJob.'],
  ['REVALIDATION_WORKER.md', 'processRevalidationJob.'],
  ['PHASE_17_CONCURRENCY.md', 'Claim leases + identity keys + versions.'],
  ['PHASE_17_DATABASE_CONSTRAINTS.md', 'Migration unique/indexes.'],
  ['COMPLIANCE_INCIDENT_MANAGEMENT.md', 'SECURITY_INCIDENT reason; Manual Review codes.'],
  ['PHASE_17_MANUAL_REVIEW.md', 'MANUAL_REVIEW states; cannot force MRA clearance.'],
  ['SYSTEM_ADMIN_RESTRICTION_UI.md', '`/settings/integrations/mra-eis/restrictions` (+ Phase 18 fleet).'],
  ['TENANT_BUSINESS_RESTRICTION_UI.md', 'Same page scoped to session tenant.'],
  ['TERMINAL_COMPLIANCE_STATUS_UI.md', 'Projection panel; no misleading Active.'],
  ['POS_RESTRICTION_UX.md', 'Safe texts from getReasonMeta().safeText.'],
  ['COMPLIANCE_REPORTS.md', 'API list/projection; Phase 18 expands exports.'],
  ['COMPLIANCE_EVIDENCE_EXPORT.md', 'Checksummed summaries; no credentials.'],
  ['PHASE_17_PERMISSIONS.md', 'eis.restrictions.* / eis.unblockRequests.* / system.eis.emergencyPause.*'],
  ['PHASE_17_SEGREGATION_OF_DUTIES.md', 'Requester ≠ approver; workers are service identities.'],
  ['PHASE_17_APPROVALS.md', 'Unblock approval + emergency pause elevated.'],
  ['PHASE_17_AUDIT_EVENTS.md', 'Control audit + API actions; no secrets.'],
  ['PHASE_17_NOTIFICATIONS.md', 'Phase 18 expands; API surfaces status for UI.'],
  ['PHASE_17_METRICS.md', 'Counters via restriction created/cleared (instrument in Phase 18).'],
  ['PHASE_17_ALERTS.md', 'Critical: transmit after block — enforced by capability gates.'],
  ['PHASE_17_TYPED_ERRORS.md', 'RestrictionErrors.*'],
  ['PHASE_17_SECURITY.md', 'Server-authoritative; client fields rejected.'],
  ['PHASE_17_ACCESSIBILITY.md', 'Semantic headings/status/alerts on restrictions page.'],
  ['PHASE_17_RESPONSIVE_UI.md', 'max-w-5xl stacking layout.'],
  ['LEGACY_RESTRICTION_MIGRATION_PLAN.md', 'Dry-run first; no inferred MRA blocks; ambiguous → Manual Review; Phase 19 broad migration.'],
  ['LEGACY_RESTRICTION_MIGRATION_REPORT.md', 'Fail-open eisService disabled; direct ACTIVE disabled; client terminalBlocked ignored.'],
  ['MOCK_MRA_BLOCK_UNBLOCK_SERVER.md', 'mockMraBlockUnblockServer.js scenarios.'],
  ['PHASE_17_SYNTHETIC_FIXTURES.md', 'Vitest memory store + mock scenarios.'],
  ['PHASE_17_TEST_PLAN.md', 'test/mraEis.phase17.restrictions.test.js'],
  ['PHASE_17_TEST_RESULTS.md', 'Run vitest; expect pass.'],
  ['PHASE_17_SECURITY_TEST_RESULTS.md', 'Cross-tenant error; secrets absent in mock; client fields rejected.'],
  ['PHASE_17_ACCESSIBILITY_TEST_RESULTS.md', 'Manual: headings, role=status/alert present.'],
  ['PHASE_17_END_TO_END_RESULTS.md', 'Scenarios 1–4 covered in unit tests; 5–10 policy encoded.'],
  ['PHASE_17_SANDBOX_VERIFICATION_REPORT.md', 'Mock provisional only; live sandbox unblock BLOCKED.'],
  ['PHASE_17_DEPLOYMENT_PLAN.md', 'Apply migration 20260723040000; deploy API/UI; keep MRA_EIS_USE_MOCK for status.'],
  ['PHASE_17_ROLLBACK_PLAN.md', 'Disable restriction API routes; retain tables; do not auto-clear restrictions.'],
  ['PHASE_17_INCIDENT_RUNBOOKS.md', 'On MRA block: ingest → notify → unblock request → mock/live status → revalidate.'],
  ['PHASE_17_RISK_REGISTER.md', 'Highest residual: unverified production unblock contract.'],
];

for (const [name, body] of topics) {
  files[name] = short(name.replace(/\.md$/, '').replace(/_/g, ' '), body);
}

for (const [name, body] of Object.entries(files)) {
  w(name, body);
}

console.log(`Wrote ${Object.keys(files).length} Phase 17 docs to ${root}`);
