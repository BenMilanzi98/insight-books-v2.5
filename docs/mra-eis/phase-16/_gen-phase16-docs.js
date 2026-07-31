/**
 * Generates Phase 16 documentation pack.
 * Run: node docs/mra-eis/phase-16/_gen-phase16-docs.js
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve('docs/mra-eis/phase-16');
fs.mkdirSync(root, { recursive: true });

function w(name, body) {
  fs.writeFileSync(
    path.join(root, name),
    `${body.trim()}\n\n---\n*Phase 16 implementation. Offline mode is disabled by default. Production requires CERTIFIED_PRODUCTION + verified contracts. Browser-only authoritative fiscal signing/storage is prohibited. navigator.onLine / localStorage / IndexedDB are not certified offline. One network failure does not enable offline. Sealed envelopes and queue items are immutable. Upload never reposts Journal/Stock. Unknown uploads require Phase 15 reconciliation. Maintenance does not auto-enable offline. No credentials/JWT/private keys/BAC in evidence.*\n`,
    'utf8'
  );
}

const O = 'lib/mraEis/application/offline/';
const short = (title, body) => `# ${title}\n\n${body}`;

const files = {
  'README.md': `# Phase 16 — Certified Offline MRA EIS Mode

**Decision:** \`READY_FOR_PHASE_17_WITH_BLOCKERS\`

## Entry
- Domain: \`${O}\`
- APIs: \`/api/mra-eis/offline\`
- UI: \`/settings/integrations/mra-eis/offline\`
- Models: \`MraEisTrustedAgent\`, \`MraEisOfflineFiscalEnvelope\`
- Migration: \`prisma/migrations/20260723030000_mra_eis_phase16_offline\`
- Tests: \`test/mraEis.phase16.offline.test.js\`
- Reuses: \`MraEisOfflineQueueEntry\`, Phase 12 sequences, Phase 14 receipt wording hooks, Phase 15 unknown-outcome recon

## Hard rules
- Offline disabled by default; not enabled by network loss alone
- Production offline **BLOCKED** without CERTIFIED_PRODUCTION
- Browser-only fiscal signing / localStorage / IndexedDB **PROHIBITED**
- Private keys never in browser JS; online JWT ≠ signing key
- Atomic offline numbers; no MAX+1; no reuse; no backward move
- Sealed envelopes/queue items immutable
- Pending receipts do not claim MRA acceptance
- Unknown upload → Phase 15 reconcile (no blind retry)
- Upload creates no Journal / Stock Movement
- Terminal blocks stop new offline Sales
`,

  'PHASE_16_TASKS.md': short(
    'Phase 16 Tasks',
    `| Stream | Status |
|---|---|
| Offline dependency audit | DONE |
| Gap register | DONE |
| Contract re-verification | DONE (mock provisional; prod BLOCKED) |
| Certification + capability policies | DONE |
| Deployment architecture decision | DONE (browser prohibited; agent required) |
| Trusted Agent model | DONE |
| Connectivity / clock / limits | DONE |
| Signer + sequence + envelope | DONE (mock) |
| Queue integrity + ordered upload | DONE (mock) |
| Browser quarantine | DONE |
| API + admin UI | DONE |
| Permissions | DONE |
| Unit tests | DONE |
| Docs + Phase 17 handover | DONE |
| Live/production offline contracts | BLOCKED |
| Full encrypted SQLite agent runtime | BLOCKED / deferred to certified agent build |
| Last Offline live query | BLOCKED (Phase 15 carry-forward) |`
  ),

  'PHASE_16_REQUIREMENT_TRACEABILITY.md': short(
    'Phase 16 Requirement Traceability',
    `| Requirement | Trace |
|---|---|
| Fail-closed offline | \`effectiveOfflineCapability.js\` |
| Certification gate | \`offlineCertificationPolicy.js\` |
| Contracts | \`offlineContractRegistry.js\` |
| Connectivity debounce | \`connectivityStateMachine.js\` |
| Clock integrity | \`clockIntegrity.js\` |
| Signer (no browser keys) | \`offlineSigner.js\` |
| Sequence atomic | \`offlineSequence.js\` |
| Envelope seal | \`offlineEnvelope.js\` |
| Queue integrity | \`queueIntegrity.js\` |
| Ordered upload | \`offlineUploadWorker.js\` |
| Browser quarantine | \`browserOfflineQuarantine.js\` |
| Trusted agent | \`trustedAgentService.js\` + Prisma |
| Legacy IndexedDB POS | \`lib/offlineSalesQueue.js\` classified UNSAFE_BROWSER_ONLY |`
  ),

  'OFFLINE_EIS_DEPENDENCY_AUDIT.md': short(
    'Offline EIS Dependency Audit',
    `| Component | Classification | Notes |
|---|---|---|
| Phase 15 Last Offline adapters | EXTEND | Remain BLOCKED until live contract |
| Phase 12 offline numbering policy | EXTEND | Mock allocation via Phase 16 sequence |
| \`offlineSigner.js\` (infra crypto) | REQUIRES_CERTIFICATION | Remains blocked; Phase 16 mock signer separate |
| \`MraEisOfflineQueueEntry\` | EXTEND | Server foundation retained |
| \`lib/offlineSalesQueue.js\` IndexedDB | UNSAFE_BROWSER_ONLY | Not MRA fiscal |
| \`public/sw.js\` | UNSAFE_BROWSER_ONLY | POS cache only |
| POS \`navigator.onLine\` | UNSAFE_BROWSER_ONLY | Insufficient |
| Android SharedPreferences queue | UNSAFE_BROWSER_ONLY | Legacy non-fiscal |
| Electron print helper | NOT_APPLICABLE | Printer only |
| Phase 3 blueprint agent | REUSE | Target architecture |`
  ),

  'PHASE_16_GAP_REGISTER.md': short(
    'Phase 16 Gap Register',
    `| ID | Gap | Severity | Status |
|---|---|---|---|
| G16-001 | Live/production offline mode contract unverified | CRITICAL | OPEN — blocked |
| G16-002 | Production signature algorithm / KAT (Q-040) | CRITICAL | OPEN — blocked |
| G16-003 | Offline numbering scope vs online (MRA) | HIGH | OPEN — mock separate; prod blocked |
| G16-004 | Offline QR / receipt live semantics | HIGH | OPEN — pending wording only |
| G16-005 | Offline upload endpoint/batch semantics | HIGH | OPEN — mock only |
| G16-006 | Full encrypted SQLite / TPM agent binary | HIGH | OPEN — architecture selected; runtime deferred |
| G16-007 | Last Offline live query | HIGH | OPEN — Phase 15 carry-forward |
| G16-008 | CERTIFIED_PRODUCTION evidence pipeline UX | MEDIUM | Foundation; no self-declare |`
  ),

  'OFFLINE_CONTRACT_DECISION.md': short(
    'Offline Contract Decision',
    `## Decision matrix

| Contract | MOCK | Live SANDBOX | PRODUCTION |
|---|---|---|---|
| Offline mode | PROVISIONAL | BLOCKED | BLOCKED |
| Signature | PROVISIONAL HMAC mock | BLOCKED | BLOCKED |
| Numbering | PROVISIONAL separate | BLOCKED | BLOCKED |
| Receipt/QR | PROVISIONAL pending wording | BLOCKED | BLOCKED |
| Upload | PROVISIONAL mock | BLOCKED | BLOCKED |

Browser authoritative fiscalization: **PROHIBITED**`
  ),

  'OFFLINE_DEPLOYMENT_ARCHITECTURE.md': short(
    'Offline Deployment Architecture',
    `## Selected default
\`BROWSER_ONLY_PROHIBITED\`

## Approved future deployment shapes (when certified)
- \`CENTRAL_SERVER_WITH_DEVICE_AGENT\`
- \`CENTRAL_SERVER_WITH_BRANCH_AGENT\`
- \`MANAGED_DESKTOP_POS_AGENT\`

## Trust boundary
- Signing + sequence + encrypted queue live in non-browser agent
- Central server owns registration, certification, upload coordination, reconciliation
- Browser POS may display status only; cannot seal/sign/clear queues`
  ),
};

const bulk = [
  ['OFFLINE_CERTIFICATION_POLICY.md', `\`${O}offlineCertificationPolicy.js\``],
  ['EFFECTIVE_OFFLINE_CAPABILITY_POLICY.md', `\`${O}effectiveOfflineCapability.js\``],
  ['TRUSTED_AGENT_MODEL.md', 'Prisma `MraEisTrustedAgent` + `trustedAgentService.js`'],
  ['STABLE_DEVICE_IDENTITY.md', 'SHA-256 of installationId+agentInstanceId; not MAC/container/UA'],
  ['AGENT_REGISTRATION.md', 'Bootstrap token TTL 15m; not permanent signing credential'],
  ['AGENT_ACTIVATION.md', 'Separate activation; cashier cannot activate'],
  ['AGENT_HEARTBEAT_HEALTH.md', 'Safe metadata only; no keys/JWT/BAC'],
  ['AGENT_VERSION_POLICY.md', 'SUPPORTED / UPDATE_* / SECURITY_BLOCKED / CERTIFICATION_BLOCKED'],
  ['SECURE_LOCAL_PERSISTENCE.md', 'Target: encrypted SQLite in agent; browser localStorage not authoritative'],
  ['LOCAL_DATA_PARTITIONING.md', 'Tenant/Business/Branch/Site/Terminal/Agent/Environment'],
  ['LOCAL_ENCRYPTION.md', 'Key-purpose separation; no plaintext fallback'],
  ['OFFLINE_KEY_ARCHITECTURE.md', 'Identity ≠ auth ≠ DB encryption ≠ MRA signing; JWT forbidden as signing key'],
  ['OFFLINE_SIGNATURE_CONTRACT_REGISTRY.md', `\`${O}offlineContractRegistry.js\` signature section`],
  ['OFFLINE_SIGNER.md', `\`${O}offlineSigner.js\` — mock HMAC; production blocked`],
  ['OFFLINE_SIGNATURE_VERIFICATION.md', 'Verify before SEALED'],
  ['OFFLINE_CONFIGURATION_PACKAGE.md', 'Immutable checksummed package model (contract-ready)'],
  ['OFFLINE_MAPPING_PACKAGE.md', 'Pinned mappings; sealed items unaffected by cache updates'],
  ['OFFLINE_PRODUCT_SERVICE_CACHE.md', 'Cache not master; pin at finalization'],
  ['OFFLINE_LIMIT_PACKAGE.md', `\`${O}offlineLimits.js\``],
  ['OFFLINE_CONFIGURATION_FRESHNESS.md', 'EXPIRED/REVOKED block new offline Sales'],
  ['CONNECTIVITY_STATE_MACHINE.md', `\`${O}connectivityStateMachine.js\``],
  ['OFFLINE_ENTRY_POLICY.md', 'Capability + proven connectivity failure + no Terminal block'],
  ['OFFLINE_EXIT_POLICY.md', 'Stable restore / limits / block / cert expiry'],
  ['DEVICE_CLOCK_INTEGRITY.md', `\`${O}clockIntegrity.js\``],
  ['OFFLINE_SALE_READINESS.md', `\`${O}offlineSaleReadiness.js\``],
  ['OFFLINE_LOCAL_FINALIZATION.md', 'Accounting/Inventory once before seal; MRA outside financial txn'],
  ['OFFLINE_FISCAL_SNAPSHOT_EVIDENCE.md', 'Reuse Phase 12 snapshot; offline refs separate'],
  ['OFFLINE_FISCAL_NUMBER_CONTRACT.md', 'Separate offline sequence when contract requires'],
  ['OFFLINE_SEQUENCE_MODEL.md', `\`${O}offlineSequence.js\``],
  ['ATOMIC_OFFLINE_NUMBER_RESERVATION.md', 'No MAX+1; process/DB transactional reservation'],
  ['OFFLINE_FISCAL_ENVELOPE.md', `\`${O}offlineEnvelope.js\` + Prisma model`],
  ['OFFLINE_PAYLOAD_MAPPING.md', 'From immutable snapshot + offline assignment only'],
  ['OFFLINE_CANONICALIZATION.md', 'Sorted-key deterministic UTF-8'],
  ['OFFLINE_QUEUE_ITEM.md', 'Sealed queue item + existing `MraEisOfflineQueueEntry`'],
  ['OFFLINE_QUEUE_PARTITIONING_ORDERING.md', 'Strict sequence order per partition'],
  ['OFFLINE_QUEUE_INTEGRITY.md', `\`${O}queueIntegrity.js\``],
  ['OFFLINE_RECEIPT_CONTRACT.md', 'Pending wording; no acceptance claim pre-upload'],
  ['OFFLINE_QR_POLICY.md', 'No invented validation URL; production blocked'],
  ['OFFLINE_RECEIPT_STATES.md', 'OFFLINE_UPLOAD_PENDING / ACCEPTED / REJECTED / UNKNOWN…'],
  ['OFFLINE_RECEIPT_IMMUTABILITY.md', 'Original immutable; acceptance projection additive'],
  ['CONNECTIVITY_RESTORATION.md', 'Stable checks before upload'],
  ['OFFLINE_QUEUE_FREEZE.md', 'Partition freeze before ordered drain'],
  ['OFFLINE_UPLOAD_CONTRACT_REGISTRY.md', 'Mock upload contract provisional'],
  ['OFFLINE_UPLOAD_ATTEMPTS.md', 'Append-only; no credentials'],
  ['ORDERED_OFFLINE_UPLOAD_WORKER.md', `\`${O}offlineUploadWorker.js\``],
  ['OFFLINE_UPLOAD_ACCEPTANCE.md', 'Application-level SUCCESS; no Journal/Stock'],
  ['OFFLINE_UPLOAD_REJECTION.md', 'Retain number/signature; no auto reverse'],
  ['OFFLINE_UPLOAD_UNKNOWN_OUTCOME.md', 'Phase 15 reconcile; block later ordered items'],
  ['OFFLINE_PARTIAL_BATCH_HANDLING.md', 'Contract-driven; do not assume atomic batch'],
  ['OFFLINE_DUPLICATE_PREVENTION.md', 'Envelope/queue/attempt unique identities'],
  ['ONLINE_OFFLINE_SEQUENCE_RECONCILIATION.md', 'Extend Phase 15; never backward'],
  ['OFFLINE_TERMINAL_BLOCK_HANDLING.md', 'Stop new offline Sales; Phase 17 unblock'],
  ['OFFLINE_CONFIGURATION_REFRESH.md', 'Preserve sealed items'],
  ['AGENT_SUSPENSION_REVOCATION.md', 'Suspend/revoke/lost/compromise workflows'],
  ['LOST_STOLEN_DEVICE.md', 'Revoke; preserve sequence; no arbitrary re-init'],
  ['OFFLINE_QUEUE_MIGRATION.md', 'Checksum + approval required'],
  ['OFFLINE_BACKUP_RESTORE.md', 'Encrypted; reject stale rollback'],
  ['OFFLINE_ANTI_ROLLBACK.md', 'Detect sequence/queue/clock rollback'],
  ['OFFLINE_TAMPER_DETECTION.md', 'Integrity failure blocks operation'],
  ['OFFLINE_ACCOUNTING_ISOLATION.md', 'Upload never creates Journals'],
  ['OFFLINE_INVENTORY_ISOLATION.md', 'Upload never creates Stock Movements'],
  ['POS_OFFLINE_UX.md', 'Truthful statuses; no green success for upload-pending'],
  ['OFFLINE_LIMIT_UX.md', 'Remaining limits; cashier cannot override'],
  ['SYSTEM_ADMIN_OFFLINE_UI.md', '`/settings/integrations/mra-eis/offline`'],
  ['TENANT_OFFLINE_UI.md', 'Same page scoped; no force accept/clear queue'],
  ['PHASE_16_PERMISSIONS.md', '`eis.offline.*` / `eis.offlineAgents.*` / `eis.offlineSequences.*`'],
  ['PHASE_16_APPROVALS.md', 'Agent activation/revocation/migration require elevated approval'],
  ['PHASE_16_SEGREGATION_OF_DUTIES.md', 'Cashier ≠ agent activator; auditors read-only'],
  ['PHASE_16_AUDIT_EVENTS.md', 'Material agent/offline actions audited; no secrets'],
  ['PHASE_16_NOTIFICATIONS.md', 'Cert expiry, limits, unknown upload, terminal block'],
  ['PHASE_16_METRICS.md', 'Counters/gauges for offline entry, queue, uploads'],
  ['PHASE_16_ALERTS.md', 'Critical: uncertified prod offline, key leak, number reuse'],
  ['PHASE_16_TYPED_ERRORS.md', '`OfflineErrors`'],
  ['PHASE_16_SECURITY.md', 'Server-authoritative; client force fields rejected'],
  ['PHASE_16_ACCESSIBILITY.md', 'Status text not colour-only'],
  ['PHASE_16_RESPONSIVE_UI.md', 'Mobile-friendly offline admin'],
  ['LEGACY_OFFLINE_MIGRATION_PLAN.md', 'Dry-run classify IndexedDB/Android queues; no historical submit'],
  ['LEGACY_OFFLINE_MIGRATION_REPORT.md', 'Legacy queues remain non-fiscal; not imported into certified sequences'],
  ['MOCK_OFFLINE_MRA_SERVER.md', `\`${O}mockOfflineMraServer.js\``],
  ['OFFLINE_CERTIFICATION_TEST_HARNESS.md', 'Unit pack + mock upload scenarios form harness core'],
  ['PHASE_16_SYNTHETIC_FIXTURES.md', 'Mock envelopes, sequences, upload scenarios'],
  ['PHASE_16_TEST_PLAN.md', 'Vitest contracts/capability/connectivity/clock/signer/sequence/envelope/queue/upload'],
  ['PHASE_16_TEST_RESULTS.md', '`npx vitest run test/mraEis.phase16.offline.test.js` — see run output'],
  ['PHASE_16_SECURITY_TEST_RESULTS.md', 'Browser force rejected; no private key in sign result'],
  ['PHASE_16_ACCESSIBILITY_TEST_RESULTS.md', 'Semantic headings/status; deeper suite deferred'],
  ['PHASE_16_END_TO_END_RESULTS.md', 'Mock seal → ordered upload accept/unknown paths'],
  ['PHASE_16_SANDBOX_CERTIFICATION_REPORT.md', 'Mock only; not MRA certification evidence'],
  ['PHASE_16_DEPLOYMENT_PLAN.md', 'Migrate Phase 16 tables; keep production offline blocked'],
  ['PHASE_16_AGENT_INSTALLATION_GUIDE.md', 'Register → bootstrap → activate; signing keys stay on agent'],
  ['PHASE_16_AGENT_UPDATE_GUIDE.md', 'Signed updates; CERTIFICATION_BLOCKED versions stop new offline Sales'],
  ['PHASE_16_BACKUP_RESTORE_RUNBOOK.md', 'Encrypted backup; reject stale rollback'],
  ['PHASE_16_DEVICE_COMPROMISE_RUNBOOK.md', 'Revoke; isolate queue; forensic preserve'],
  ['PHASE_16_LOST_DEVICE_RUNBOOK.md', 'Mark LOST; revoke; reconcile before replacement'],
  ['PHASE_16_QUEUE_RECOVERY_RUNBOOK.md', 'Integrity verify; migrate with approval'],
  ['PHASE_16_ROLLBACK_PLAN.md', 'Stop agent offline entry; leave sealed evidence; revert app'],
  ['PHASE_16_RISK_REGISTER.md', 'Primary risk: unverified prod contracts — mitigated by BLOCKED defaults'],
];

for (const item of bulk) {
  files[item[0]] = short(item[0].replace(/\.md$/, '').replace(/_/g, ' '), item[1]);
}

files['PHASE_17_HANDOVER.md'] = short(
  'Phase 17 Handover',
  `## Phase 17 implements
Complete Terminal blocking/unblocking, compliance suspensions, agent/device blocks, unblock-status queries, post-unblock config/credential/key revalidation, queue re-evaluation, emergency pause.

## Phase 17 receives from Phase 16
- Trusted Agent lifecycle (ACTIVE/SUSPENDED/BLOCKED/REVOKED/LOST/COMPROMISED)
- Offline capability + certification gates
- Connectivity + clock + limit policies
- Sealed envelopes + queue integrity
- Ordered upload unknown → Phase 15
- Terminal-block stop of new offline Sales
- Receipt pending vs accepted distinction

## Must preserve
Immutable snapshots, fiscal numbers, offline signatures, queue order, response evidence, original receipts, accounting/inventory isolation`
);

files['PHASE_16_READINESS_DECISION.md'] = short(
  'Phase 16 Readiness Decision',
  `## Decision: READY_FOR_PHASE_17_WITH_BLOCKERS

| Area | Result |
|---|---|
| Offline contracts (mock) | PROVISIONAL |
| Offline contracts (prod) | BLOCKED |
| Certification policy | PASS (fail-closed) |
| Capability policy | PASS |
| Architecture | Browser prohibited; agent-required |
| Trusted Agent | PASS (registration/activation/heartbeat/revoke) |
| Connectivity / clock / limits | PASS |
| Signer / sequence / envelope (mock) | PASS |
| Queue integrity / ordered upload (mock) | PASS |
| Browser quarantine | PASS |
| API / UI / permissions | PASS |
| Full agent encrypted runtime | BLOCKED / deferred |
| Production offline Sales | BLOCKED |

### Remaining blockers
G16-001…G16-008 (+ Phase 13–15 carry-forward)

### Recommended next action
Implement Phase 17 Terminal block/unblock controls; keep production offline gated.`
);

files['FINAL_PHASE_16_IMPLEMENTATION_REPORT.md'] = short(
  'Final Phase 16 Implementation Report',
  `## Executive summary
Phase 16 delivers a certification-gated, fail-closed offline fiscalization foundation: contract registries, certification and capability policies, trusted agent lifecycle, connectivity/clock/limit controls, mock offline signing and atomic numbering, sealed envelopes, queue integrity, ordered mock upload with unknown-outcome handoff to Phase 15, and admin UI — while keeping production offline and browser-authoritative fiscalization correctly blocked.

## Confirmations
- Offline disabled by default; not enabled by single network failure
- Production requires CERTIFIED_PRODUCTION + verified contracts
- Browser localStorage/IndexedDB not authoritative
- Private keys never reach browser JS; JWT not used as signing key
- Offline numbers atomic; no MAX+1; no reuse; no backward move
- Sealed envelopes immutable; pending receipts do not claim acceptance
- Unknown uploads not blindly retried
- Upload creates no Journal/Stock Movement
- Terminal blocks stop new offline Sales
- Maintenance does not auto-enable offline

## Decision
\`READY_FOR_PHASE_17_WITH_BLOCKERS\`

## Honest conclusion
InsightBooks can exercise a mock certified-offline engine behind fail-closed gates and agent registration. Live/production offline Sales remain correctly blocked until MRA contracts, signature KAT, numbering rules, and a certified non-browser agent runtime are verified.`
);

for (const [name, body] of Object.entries(files)) {
  w(name, body);
}

console.log(`Wrote ${Object.keys(files).length} Phase 16 docs to ${root}`);
