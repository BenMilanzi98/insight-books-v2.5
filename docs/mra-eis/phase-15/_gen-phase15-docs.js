/**
 * Generates Phase 15 documentation pack.
 * Run: node docs/mra-eis/phase-15/_gen-phase15-docs.js
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve('docs/mra-eis/phase-15');
fs.mkdirSync(root, { recursive: true });

function w(name, body) {
  fs.writeFileSync(
    path.join(root, name),
    `${body.trim()}\n\n---\n*Phase 15 implementation. RECONCILE FIRST — DO NOT RETRY unknown outcomes. Timeout/HTTP 500/worker crash ≠ not processed. Absence from Last Online (single latest) is not conclusive. Safe retry reuses the same Transmission, Fiscal Snapshot and fiscal number; creates a new append-only Attempt only. No Journal/Stock Movement. No Snapshot/Response/Receipt mutation. No credentials/BAC. Live Last Online + Last Offline blocked until verified/certified. Production offline mode never auto-enabled.*\n`,
    'utf8'
  );
}

const R = 'lib/mraEis/application/reconciliation/';
const short = (title, body) => `# ${title}\n\n${body}`;

const files = {
  'README.md': `# Phase 15 — MRA EIS Retry, Unknown-Outcome Reconciliation & Recovery

**Decision:** \`READY_FOR_PHASE_16_WITH_BLOCKERS\`

## Entry
- Domain: \`${R}\`
- APIs: \`/api/mra-eis/reconciliation\`
- UI: \`/settings/integrations/mra-eis/reconciliation\`
- Workers: \`processTransmissionReconciliationOutboxBatch\`, \`processAuthorizedRetryBatch\`
- Models: \`MraEisTransmissionReconciliation\`, \`MraEisReconciliationQueryAttempt\`, \`MraEisRetryAuthorization\`, \`MraEisCircuitBreaker\`
- Migration: \`prisma/migrations/20260723020000_mra_eis_phase15_reconciliation\`
- Tests: \`test/mraEis.phase15.reconciliation.test.js\`

## Hard rules
- Reconcile before retry for UNKNOWN_OUTCOME
- Timeout / connection reset / HTTP 500 / worker crash remain ambiguous
- Last Online absence (SINGLE_LATEST) ≠ DEFINITELY_NOT_PROCESSED
- Duplicate ≠ automatic acceptance
- Safe retry: same Transmission + Snapshot + fiscal number; new Attempt only
- No accounting / inventory repost or reverse
- No Snapshot / Response Evidence / original Receipt mutation
- No credentials or Buyer Authorization Code in evidence
- Live Last Online + Last Offline **BLOCKED**
- Maintenance does not enable Offline mode
`,

  'PHASE_15_TASKS.md': short(
    'Phase 15 Tasks',
    `| Stream | Status |
|---|---|
| Retry/recon dependency audit | DONE |
| Gap register | DONE |
| Disable blind EIS retry paths | DONE (sales-transmission \`retry\` → 409) |
| Last Online contract re-verify | DONE (mock provisional; live/prod BLOCKED) |
| Last Offline contract | BLOCKED until Phase 16 |
| Contract / Retry / Remediation registries | DONE |
| Reconciliation aggregate + state machine | DONE |
| Local evidence + checksum + validation | DONE |
| Dispatch certainty | DONE |
| Query attempts + mock Last Online | DONE |
| Comparator + match confidence + outcomes | DONE |
| Acceptance / rejection / DNP / duplicate | DONE |
| Safe retry authorization + controlled retry | DONE |
| Auth / config / rate-limit / maintenance / CB | DONE (foundations) |
| Sequence reconciliation (no backward move) | DONE |
| Missing Event / Receipt recovery | DONE |
| Worker + scheduler + API + UI | DONE |
| Permissions | DONE |
| Unit tests | DONE |
| Docs + Phase 16 handover | DONE |
| Live Last Online / Offline queries | BLOCKED |`
  ),

  'PHASE_15_REQUIREMENT_TRACEABILITY.md': short(
    'Phase 15 Requirement Traceability',
    `| Requirement | Trace |
|---|---|
| Reconcile-first | \`retryPolicyRegistry.js\` + sales-transmission blind-retry 409 |
| Last Online contract | \`lastTransactionContractRegistry.js\` |
| Absence not conclusive | \`absenceIsConclusive: false\` + comparator TARGET_NOT_RETURNED |
| Dispatch certainty | \`dispatchCertainty.js\` |
| Local evidence checksum | \`localEvidence.js\` |
| Comparator / decimals | \`localMraComparator.js\` |
| Acceptance recovery | \`reconciliationOrchestrator.js\` → RECONCILED_ACCEPTED + Phase 14 outbox |
| Safe retry | \`controlledSafeRetry.js\` + \`retryScheduler.js\` |
| Sequence never backwards | \`sequenceReconciliation.js\` |
| Circuit breaker probes | \`circuitBreaker.js\` — no Sales probes |
| Missing receipt recovery | \`missingEvidenceRecovery.js\` |
| Typed errors | \`reconciliationErrors.js\` |
| API / UI | \`/api/mra-eis/reconciliation\`, settings reconciliation page |`
  ),

  'RETRY_RECONCILIATION_DEPENDENCY_AUDIT.md': short(
    'Retry Reconciliation Dependency Audit',
    `| Component | Classification | Notes |
|---|---|---|
| sales-transmission \`action=retry\` | DISABLE / WRAP | Returns 409; points to Phase 15 |
| Phase 13 \`RECONCILE_BEFORE_RETRY\` | REUSE | Emits Phase 15 outbox event |
| Phase 13 transmission orchestrator | EXTEND | Rejects UNKNOWN blind retry; allows RETRY_SCHEDULED |
| \`reconciliationService.js\` (generic runs) | LEGACY_READ_ONLY / WRAP | Not the Phase 15 engine |
| Last Online/Offline adapters | EXTEND | Mock path when contract allows |
| Phase 12 sequence models | REUSE | Reconciliation explains gaps; no auto decrement |
| Phase 14 receipt worker | REUSE | Missing receipt recovery recreates outbox only |
| Queue / Cron blind retries | DISABLE for EIS Sales | Must not resubmit without Phase 15 auth |
| Manual “mark accepted” UI | UNSAFE_STATUS_OVERRIDE | Rejected in recon API client fields |
| Circuit breaker | EXTEND | New \`MraEisCircuitBreaker\` model |`
  ),

  'PHASE_15_GAP_REGISTER.md': short(
    'Phase 15 Gap Register',
    `| ID | Gap | Severity | Status |
|---|---|---|---|
| G15-001 | Live sandbox Last Online contract unverified | HIGH | OPEN — query blocked |
| G15-002 | Production Last Online contract unverified | CRITICAL | OPEN — query blocked |
| G15-003 | Last Offline blocked until certified offline | HIGH | OPEN — Phase 16 |
| G15-004 | Duplicate response semantics need MRA clarification | HIGH | OPEN — conservative classification |
| G15-005 | Carry-forward G13 message-hash / success-code | HIGH | OPEN |
| G15-006 | Production receipt/QR still gated (Phase 14) | HIGH | OPEN |
| G15-007 | Full approval workflow UI for production retry | MEDIUM | Foundation; production requires approval flag |
| G15-008 | Legacy blind-retry history migration breadth | MEDIUM | Dry-run plan; Phase 19 owns broad migration |`
  ),

  'LAST_TRANSACTION_CONTRACT_DECISION.md': short(
    'Last Transaction Contract Decision',
    `## Decision matrix

| Endpoint | Environment | Decision | Query |
|---|---|---|---|
| Last Online | MOCK / DEV | PROVISIONAL_SANDBOX_ONLY | ALLOWED |
| Last Online | Live SANDBOX | BLOCKED | BLOCKED |
| Last Online | PRODUCTION | BLOCKED | BLOCKED |
| Last Offline | All | BLOCKED | BLOCKED |

## Critical semantics
- Result cardinality: **SINGLE_LATEST**
- \`absenceIsConclusive: false\`
- Different latest → RESPONSE_WINDOW_INSUFFICIENT / STILL_UNKNOWN
- Do not infer acceptance from sequence advance alone`
  ),
};

const bulk = [
  ['RECONCILIATION_CONTRACT_REGISTRY.md', `\`${R}lastTransactionContractRegistry.js\``],
  ['RETRY_POLICY_REGISTRY.md', `\`${R}retryPolicyRegistry.js\` — unknown never auto-retry; same snapshot/number required.`],
  ['REJECTED_REMEDIATION_REGISTRY.md', `\`${R}rejectedRemediationRegistry.js\` — no snapshot edit; no auto accounting reverse.`],
  ['RECONCILIATION_AGGREGATE.md', `Model \`MraEisTransmissionReconciliation\` — unique per tenant/business/transmission/attempt/reason/env.`],
  ['RECONCILIATION_STATE_MACHINE.md', `CREATED→…→ACCEPTED_CONFIRMED / STILL_UNKNOWN / RETRY_* / MANUAL_REVIEW / DEAD_LETTER. STILL_UNKNOWN cannot jump to RETRY_SCHEDULED.`],
  ['RECONCILIATION_IDEMPOTENCY.md', `Case identity + query attempt number + retry auth consumption + recovery event uniqueness.`],
  ['AUTHORITATIVE_LOCAL_EVIDENCE.md', `\`${R}localEvidence.js\` — immutable snapshot/attempts/responses; checksummed.`],
  ['LOCAL_EVIDENCE_VALIDATION.md', `Invalid local evidence → Manual Review; no external retry.`],
  ['DISPATCH_CERTAINTY_RECONSTRUCTION.md', `\`${R}dispatchCertainty.js\``],
  ['RECONCILIATION_QUERY_ATTEMPTS.md', `Append-only \`MraEisReconciliationQueryAttempt\`; no credentials.`],
  ['LAST_ONLINE_TRANSACTION_QUERY.md', `\`${R}lastTransactionClient.js\` + mock server; live blocked.`],
  ['LAST_OFFLINE_TRANSACTION_QUERY.md', `Interface retained; queries BLOCKED until Phase 16.`],
  ['MRA_RECONCILIATION_EVIDENCE.md', `\`normalizeMraReconciliationEvidence\` — immutable normalized DTO + checksum.`],
  ['LOCAL_MRA_COMPARATOR.md', `\`${R}localMraComparator.js\` — exact decimals; required-field rules.`],
  ['RECONCILIATION_MATCH_CONFIDENCE.md', `CONCLUSIVE/STRONG/PARTIAL/WEAK/CONFLICTING/NO_MATCH/INSUFFICIENT — no % auto-accept.`],
  ['RECONCILIATION_OUTCOME_CLASSIFICATION.md', `RECONCILIATION_OUTCOME enum + policy mapping to retry/sequence/Phase 14 actions.`],
  ['ACCEPTANCE_RECOVERY.md', `RECONCILED_ACCEPTED + Phase 14 outbox; no Sale resubmit.`],
  ['REJECTION_RECOVERY.md', `Preserve snapshot/number; remediation class; no blind retry.`],
  ['DEFINITELY_NOT_PROCESSED_POLICY.md', `Only with conclusive evidence + pre-dispatch certainty; absence ≠ DNP.`],
  ['DUPLICATE_OUTCOME_RESOLUTION.md', `Duplicate requires matching evidence; mismatch → Manual Review.`],
  ['SAFE_RETRY_AUTHORIZATION.md', `\`${R}controlledSafeRetry.js\` evaluateSafeRetryAuthorization.`],
  ['RETRY_AUTHORIZATION_MODEL.md', `\`MraEisRetryAuthorization\` AUTHORIZED→CONSUMED; expiry enforced.`],
  ['CONTROLLED_SAFE_RETRY.md', `Same Transmission/Snapshot/number; new Attempt via Phase 13 transmit.`],
  ['RETRY_BACKOFF_POLICY.md', `Exponential + full jitter + Retry-After; bounded.`],
  ['AUTHENTICATION_REMEDIATION.md', `Remediate credentials then re-evaluate; does not prove prior non-processing.`],
  ['CONFIGURATION_REFRESH_REMEDIATION.md', `Phase 8 refresh; snapshot not mutated; reconcile ambiguous first.`],
  ['TERMINAL_BLOCK_ENFORCEMENT.md', `Stops claims/retries; tenant cannot override BLOCKED→ACTIVE.`],
  ['RATE_LIMIT_RECOVERY.md', `Retry-After when verified; per-terminal backoff; no storm.`],
  ['MRA_MAINTENANCE_RECOVERY.md', `Circuit open / pause / probe; offline mode never auto-enabled.`],
  ['CIRCUIT_BREAKER_RECOVERY.md', `\`${R}circuitBreaker.js\` — safe non-Sales probes only.`],
  ['FISCAL_SEQUENCE_RECONCILIATION.md', `\`${R}sequenceReconciliation.js\` — explain gaps; never decrement nextValue.`],
  ['FISCAL_SEQUENCE_ADJUSTMENT.md', `Append-only adjustment model reserved; no backward adjustment; approval required.`],
  ['MRA_AHEAD_HANDLING.md', `Escalate / pause / Manual Review; no fabricated local txns; no silent sequence jump.`],
  ['LOCAL_AHEAD_HANDLING.md', `Explain pending/rejected/unknown; never move sequence backwards.`],
  ['MISSING_RESPONSE_EVIDENCE_RECOVERY.md', `Recovered evidence has explicit provenance; never fabricate original response.`],
  ['MISSING_TRANSMISSION_STATE_RECOVERY.md', `Evidence-driven repair transitions; conflicts → Manual Review.`],
  ['MISSING_OUTBOX_EVENT_RECOVERY.md', `Idempotent recreation of Phase 14/15 events.`],
  ['MISSING_FISCAL_RECEIPT_RECOVERY.md', `\`${R}missingEvidenceRecovery.js\` — no Sale resubmit.`],
  ['STUCK_QUEUE_WORKER_RECOVERY.md', `Reclaim leases; dedupe; respect blocks/CB/auth.`],
  ['DEAD_LETTER_MANAGEMENT.md', `Visible DL cases; retry never bypasses policy.`],
  ['MANUAL_REVIEW_CASES.md', `Cannot force acceptance or fabricate MRA evidence.`],
  ['MANUAL_REVIEW_DECISIONS.md', `Permitted decisions audited; prohibited force-accept/number change.`],
  ['RECONCILIATION_WORKER.md', `\`${R}reconciliationWorker.js\` — durable outbox consumer.`],
  ['RETRY_SCHEDULER.md', `\`${R}retryScheduler.js\` — authorized retries only.`],
  ['PHASE_15_CONCURRENCY.md', `Unique case identity, auth consumption, attempt numbers, version CAS.`],
  ['PHASE_15_DATABASE_CONSTRAINTS.md', `Migration unique indexes for recon/query/auth/CB.`],
  ['PHASE_15_SECURITY.md', 'Server-only; client cannot force outcomes/endpoints/JWT/fiscal numbers.'],
  ['PHASE_15_PERMISSIONS.md', '`eis.reconciliation.*`, `eis.retry.*`, `eis.sequenceReconciliation.*`, `eis.recovery.*`'],
  ['PHASE_15_APPROVALS.md', 'Production safe retry requires approval; self-approval prevention via existing Approval Engine hooks.'],
  ['PHASE_15_SEGREGATION_OF_DUTIES.md', 'Workers service identities; auditors read-only; creator ≠ high-risk approver.'],
  ['PHASE_15_AUDIT_EVENTS.md', 'Material recon/retry/recovery actions audited; no credentials.'],
  ['PHASE_15_NOTIFICATIONS.md', 'Truthful status messages; tenant/business scoped; deduped.'],
  ['PHASE_15_METRICS.md', 'Counters/gauges for cases, unknown backlog, retries, CB, sequence conflicts.'],
  ['PHASE_15_ALERTS.md', 'Critical: accepted retried, unknown blind-retry, number reuse, sequence backwards, credential leak.'],
  ['PHASE_15_TYPED_ERRORS.md', '`ReconciliationErrors`'],
  ['SYSTEM_ADMIN_RECONCILIATION_UI.md', 'Settings reconciliation page (tenant-scoped support view).'],
  ['TENANT_RECONCILIATION_UI.md', '`/settings/integrations/mra-eis/reconciliation`'],
  ['SAFE_RETRY_UI.md', 'Evaluate/process retries; no blind retry button for UNKNOWN.'],
  ['SEQUENCE_RECONCILIATION_UI.md', 'Sequence reconcile action; no direct nextValue edit.'],
  ['RECONCILIATION_REPORTS.md', 'Case list filters by state/outcome; export via evidence package policy.'],
  ['RECONCILIATION_EVIDENCE_EXPORT.md', 'Checksummed summary; credentials/BAC excluded.'],
  ['PHASE_15_ACCESSIBILITY.md', 'Status text not colour-only; keyboard actions; semantic headings.'],
  ['PHASE_15_RESPONSIVE_UI.md', 'Mobile-friendly case list; long fiscal numbers wrap.'],
  ['LEGACY_RETRY_RECONCILIATION_MIGRATION_PLAN.md', 'Dry-run classify legacy retries; disable unsafe jobs; no historical submit; Phase 19 for breadth.'],
  ['LEGACY_RETRY_RECONCILIATION_MIGRATION_REPORT.md', 'Unsafe blind EIS retry path disabled at API. No historical Sales resubmitted.'],
  ['MOCK_RECONCILIATION_SERVER.md', `\`${R}mockLastTransactionServer.js\``],
  ['PHASE_15_SYNTHETIC_FIXTURES.md', 'Mock Last Online scenarios + unit fixtures for comparator/dispatch/retry.'],
  ['PHASE_15_TEST_PLAN.md', 'Vitest contracts, dispatch certainty, comparator, retry policy, mock server, remediation, CB, errors.'],
  ['PHASE_15_TEST_RESULTS.md', '`npx vitest run test/mraEis.phase15.reconciliation.test.js` — see run output.'],
  ['PHASE_15_SECURITY_TEST_RESULTS.md', 'Client forced fields rejected; no JWT in mock responses/logs.'],
  ['PHASE_15_ACCESSIBILITY_TEST_RESULTS.md', 'UI uses text status + roles; deeper a11y suite deferred.'],
  ['PHASE_15_END_TO_END_RESULTS.md', 'Scenarios 1–10 encoded in unit/orchestrator paths; mock Last Online only.'],
  ['PHASE_15_SANDBOX_VERIFICATION_REPORT.md', 'Mock provisional only. Live Last Online blocked.'],
  ['PHASE_15_DEPLOYMENT_PLAN.md', 'Apply Phase 15 migration; keep MRA_EIS_USE_MOCK=1; do not enable live Last Online/Offline.'],
  ['PHASE_15_ROLLBACK_PLAN.md', 'Stop recon/retry workers; leave evidence; do not rewind sequences; revert app.'],
  ['PHASE_15_INCIDENT_RUNBOOKS.md', `| Incident | Action |\n|---|---|\n| UNKNOWN_OUTCOME | Reconcile; never blind retry |\n| Timeout | Treat ambiguous; Last Online under contract |\n| Accepted recovered | Create Phase 14 event; no Sale |\n| MRA ahead | Pause/escalate; no sequence jump |\n| Terminal blocked | Stop retries; system remediation |\n| Missing receipt | recover-receipts; no resubmit |`],
  ['PHASE_15_RISK_REGISTER.md', 'Primary risks: unverified live Last Online; mitigated by BLOCKED contracts + reconcile-first policy.'],
];

for (const item of bulk) {
  files[item[0]] = short(item[0].replace(/\.md$/, '').replace(/_/g, ' '), item[1]);
}

files['PHASE_16_HANDOVER.md'] = short(
  'Phase 16 Handover',
  `## Phase 16 will implement
Certified Offline EIS Mode: eligibility/certification gates, offline agent, offline sequences/signatures, durable offline queue, ordered batch upload, online/offline sequence reconciliation.

## Phase 16 receives from Phase 15
- Reconciliation Contract Registry (Last Online mock provisional; Offline blocked)
- Last Online mock query + blocked live/prod contracts
- Last Offline interfaces (disabled)
- Fiscal Sequence Reconciliation (explain-only; no backward move)
- Retry Policy Registry (unknown never auto-retry)
- Acceptance/rejection recovery + safe retry authorization
- Circuit breaker (no Sales probes; offline never auto-enabled)
- Missing Event/Receipt recovery patterns
- Manual Review boundaries (no force acceptance)

## Phase 16 must not enable production offline unless
- MRA certification permits it
- Offline API + signature contracts verified
- Secure non-browser persistence exists
- Offline sequence rules verified
- Recovery/reconciliation proven
- Security review + production approval`
);

files['PHASE_15_READINESS_DECISION.md'] = short(
  'Phase 15 Readiness Decision',
  `## Decision: READY_FOR_PHASE_16_WITH_BLOCKERS

| Area | Result |
|---|---|
| Last Online (mock) | PROVISIONAL — ALLOWED |
| Last Online (live/prod) | BLOCKED |
| Last Offline | BLOCKED |
| Reconciliation registry | PASS |
| Retry policy | PASS (reconcile-first) |
| Local evidence + dispatch certainty | PASS |
| Comparator + confidence + outcomes | PASS |
| Acceptance / rejection recovery | PASS (mock path) |
| Definitely-not-processed | PASS (conclusive only) |
| Duplicate resolution | PASS (conservative) |
| Safe retry | PASS (authorized; same snapshot/number) |
| Terminal / config / auth remediation | PASS (foundations) |
| Rate-limit / maintenance / CB | PASS (foundations) |
| Sequence reconciliation | PASS (no backward move) |
| Missing Event / Receipt recovery | PASS |
| Manual Review boundaries | PASS |
| Worker / scheduler / API / UI | PASS |
| Multi-tenant scoping | PASS |
| Security (no credentials/BAC) | PASS |
| Tests | PASS (unit pack) |
| Production Last Online queries | BLOCKED |
| Certified Offline | BLOCKED (Phase 16) |

### Remaining blockers
G15-001…G15-008 (+ Phase 13/14 carry-forward)

### Recommended next action
Begin Phase 16 offline architecture under certification gates; keep live Last Online/Offline blocked.`
);

files['FINAL_PHASE_15_IMPLEMENTATION_REPORT.md'] = short(
  'Final Phase 15 Implementation Report',
  `## Executive summary
Phase 15 delivers an evidence-driven reconciliation and recovery engine: local evidence reconstruction, dispatch-certainty classification, contract-gated Last Online queries (mock only), deterministic local-versus-MRA comparison, acceptance/rejection recovery without Sale resubmission, safe-retry authorization that reuses Snapshot and fiscal number, sequence gap explanation without backward movement, missing Event/Receipt recovery, and operational UI/API — with live Last Online and all Last Offline paths correctly blocked.

## Confirmations
- UNKNOWN_OUTCOME is never blindly retried
- Timeout / HTTP 500 / worker crash ≠ not processed
- Absence from SINGLE_LATEST Last Online ≠ DEFINITELY_NOT_PROCESSED
- Acceptance recovery requires conclusive evidence and does not resubmit
- Safe retry reuses Transmission + Snapshot + fiscal number; new Attempt only
- Sequences never move backwards automatically; consumed numbers never reused
- Terminal blocks stop retries; tenants cannot override
- Maintenance does not enable Offline mode
- No Journal / Stock Movement / Snapshot / Response / original Receipt mutation
- No credentials / BAC in reconciliation evidence
- Cross-tenant reconciliation rejected by tenant/business scoping

## Decision
\`READY_FOR_PHASE_16_WITH_BLOCKERS\`

## Honest conclusion
InsightBooks can safely reconcile uncertain mock MRA outcomes and authorize evidence-proven retries without corrupting fiscal identity or accounting. Live Last Online and certified Offline remain correctly blocked until MRA contracts and certification are verified.`
);

for (const [name, body] of Object.entries(files)) {
  w(name, body);
}

console.log(`Wrote ${Object.keys(files).length} Phase 15 docs to ${root}`);
