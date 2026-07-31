const fs = require('fs');
const path = require('path');
const { doc, adr, written, D } = require('./_gen-phase3-pack-part2.js');

doc('EIS_RECONCILIATION_ARCHITECTURE.md', 'EIS Reconciliation Architecture', [
  'Types: eligibility, snapshot, transmission, last-online/offline, fiscal#, amounts, VAT, mappings, config, QR, queue, daily summary, terminal status.',
  '',
  'Differences: LOCAL_SALE_WITHOUT_SNAPSHOT, SNAPSHOT_WITHOUT_TRANSMISSION, UNKNOWN_OUTCOME, DUPLICATE_*, MISMATCH_*, MRA_WITHOUT_LOCAL, OFFLINE_OVERDUE, SEQUENCE_GAP, …',
  '',
  '**Never creates/modifies Journals.** Overrides need approval + audit.',
]);

doc('EIS_REPORTING_ARCHITECTURE.md', 'EIS Reporting Architecture', [
  'Registers for accepted/pending/rejected/unknown/offline, fiscal numbers, terminals, configs, mappings, VAT5, daily recon, queue health, certification readiness, retries/DLQ.',
  '',
  'Tenant/business scoped; no secrets; link to Sale+Journal+Snapshot+Transmission. Reports do **not** redefine Revenue.',
]);

doc('EIS_READ_MODEL_ARCHITECTURE.md', 'EIS Read Model Architecture', [
  'Derived: tenant status, readiness, terminal health, queue summary, daily summary, mapping completeness, recon summary, receipt EIS status.',
  '',
  'Rebuildable; versioned; never store decrypted credentials.',
]);

doc('EIS_PERMISSION_ARCHITECTURE.md', 'EIS Permission Architecture', [
  'System: `system.eis.*` (view, entitlement grant/suspend/revoke, certification, production.enable, emergency.pause, support).',
  '',
  'Tenant: `eis.view|setup|enable|pause|terminal.*|configuration.*|site.map|product.*|tax.*|paymentMethod.map|transactions.*|offline.view|reports.*|audit.view|manualReview.resolve`',
  '',
  'Enforce server-side on API/services/workers/exports. Replace coarse `reports.view` gate for /eis.',
]);

doc('EIS_APPROVAL_ARCHITECTURE.md', 'EIS Approval Architecture', [
  'Use SecV2 approvals for: production activation, terminal activate, credential reset, offline enable, mapping overrides, historical submit, permanent-reject retry, recon override, disable with queue, terminal replace, cert change.',
  '',
  'Checksum + no self-approval + expiry + reason. Ordinary technical retries: no approval.',
]);

doc('EIS_AUDIT_ARCHITECTURE.md', 'EIS Audit Architecture', [
  'Append-only events for entitlement, setup, activation, credentials (ref only), config, mappings, eligibility, snapshot, number, transmission, attempts (safe), accept/reject/unknown, recon, offline, block, QR, exports, secret-access attempts, disable.',
  '',
  'No secrets in before/after.',
]);

doc('EIS_LOGGING_AND_REDACTION_ARCHITECTURE.md', 'EIS Logging and Redaction Architecture', [
  'Safe fields: tenant/business/branch/terminal ids, source ids, snapshot/transmission/attempt ids, fiscalNumber, environment, endpoint, HTTP/MRA status, safe error, duration, correlation.',
  '',
  'Redact Authorization, JWT, secret, TAC, buyer auth, raw payloads. Apply at client, workers, errors, monitoring.',
]);

doc('EIS_OBSERVABILITY_ARCHITECTURE.md', 'EIS Observability Architecture', [
  'Counters/gauges/histograms as prompt. Dashboards: platform/tenant/terminal/queue/API/recon/security. SLOs: accept latency, queue delay, config freshness, unknown resolution, QR availability.',
]);

doc('EIS_ALERT_ARCHITECTURE.md', 'EIS Alert Architecture', [
  'Critical: block, fiscal collision, cross-tenant cred access, decrypt fail, MRA without local, offline threshold, unknown beyond limit, queue corruption.',
  '',
  'High/moderate as prompt. Each: trigger, severity, recipients, dedupe, cooldown, runbook.',
]);

doc('EIS_ERROR_TAXONOMY.md', 'EIS Error Taxonomy', [
  'Typed errors: Entitlement · Setup · Terminal · Configuration · Snapshot · Numbering · Transmission · Contract · B2B/VAT5 · Offline · MultiTenant — as listed in Phase 3 prompt.',
  '',
  'Each: stable code, safe message, retryability, user/admin action, alert severity, audit flag.',
]);

doc('EIS_DATABASE_SCHEMA_BLUEPRINT.md', 'EIS Database Schema Blueprint', [
  '## Additive entities (conceptual)',
  '',
  'MraEisTenantEntitlement · MraEisBusinessSetting · MraEisCertification · MraEisTerminal · MraEisTerminalCredential · MraEisConfigurationSnapshot · MraEisSiteMapping · MraEisExternalProduct · MraEisProductMapping · MraEisTaxMapping · MraEisLevyMapping · MraEisPaymentMethodMapping · MraEisFiscalSequence · MraEisFiscalNumberAllocation · MraEisSnapshot (+Line +Payment) · MraEisTransmission · MraEisTransmissionAttempt · MraEisResponse · MraEisReceiptProjection · MraEisVat5Validation · MraEisOfflineQueueEntry · MraEisOutbox · MraEisReconciliationRun · MraEisReconciliationDifference · MraEisSyncRun · MraEisManualReviewCase',
  '',
  '## Legacy',
  '',
  'EISInvoice / EISConfiguration / EISSubmissionLog / EISUsage → migrate read-only then supersede; do not dual-write forever.',
  '',
  'Do not duplicate Sale/Customer/Product/Journal tables. **Entity count (new conceptual):** ~26.',
]);

doc('EIS_DATABASE_CONSTRAINTS.md', 'EIS Database Constraints', [
  'Unique: entitlement(tenant,version); active setting(business); terminal(mraTerminalId); sequence(terminalId,businessDate); fiscalNumber; snapshot(sourceType,sourceId,sourceVersion); active transmission(snapshotId); accepted(snapshotId); attempt(transmissionId,n); offline(snapshotId).',
  '',
  'FKs enforce same tenantId on related rows. No cross-tenant credential links. Accepted/queued snapshots immutable (app + optional DB triggers).',
  '',
  '**Constraint count (core unique/FK rules):** ≥20 documented.',
]);

doc('EIS_INDEX_STRATEGY.md', 'EIS Index Strategy', [
  'Indexes on: entitlement status; setting status; terminal(status,env); config(terminal,type,active); mappings; sequence; fiscalNumber; snapshot source; transmission(status,nextAttemptAt,oldest); attempts; validationURL; recon; created/accepted dates; (tenantId,businessId) everywhere.',
  '',
  'No indexes on secret ciphertext needing plaintext search.',
]);

doc('EIS_DATA_CLASSIFICATION_AND_RETENTION.md', 'EIS Data Classification and Retention', [
  '| Data | Class | Encrypt | Retain |',
  '|---|---|---|---|',
  '| JWT/secretKey | SECRET | Yes | Until rotate/revoke + legal min |',
  '| TAC / buyer auth | SHORT_LIVED_SECRET | Yes / transient | Minimal |',
  '| TIN / buyer TIN | CONFIDENTIAL | At rest policy | Legal invoice retention |',
  '| Snapshot / transmission | CONFIDENTIAL | Optional field | Legal + audit |',
  '| validationURL / QR | INTERNAL | No | With invoice |',
  '',
  'Legal periods: counsel (Phase 1). Never keep secrets only because invoices retained.',
]);

doc('EIS_CACHE_POLICY.md', 'EIS Cache Policy', [
  'Cacheable: effective capability, active config version#, mapping completeness, terminal health, dashboards — keys include tenant+env+version.',
  '',
  'Never cache decrypted JWT/secret/TAC/buyer auth.',
]);

doc('EIS_FILE_AND_EVIDENCE_STORAGE.md', 'EIS File and Evidence Storage', [
  'Private tenant-scoped storage for cert docs, PDFs, QR assets, restricted request/response evidence, recon packs, exports. Signed expiring URLs; checksums; no public buckets; no executables.',
]);

doc('EIS_FEATURE_FLAG_ARCHITECTURE.md', 'EIS Feature Flag Architecture', [
  'Flags: platform, entitlement, operational, sandbox, production, activation, productSync, posFiscalization, invoiceFiscalization, onlineTransmit, offline, vat5, autoRetry, reconciliation, receiptQr.',
  '',
  'Precedence: kill switch > suspension > entitlement > env > operational > terminal > feature flag. Flags ≠ permissions/cert bypass.',
]);

doc('EIS_BACKWARD_COMPATIBILITY_ARCHITECTURE.md', 'EIS Backward Compatibility Architecture', [
  'Non-entitled tenants unchanged. Historical sales unchanged. Additive fields. EIS failure ≠ accounting failure. Legacy EIS tables read-only until migrated. Credentials not mandatory for all tenants.',
]);

doc('EIS_DATA_MIGRATION_ARCHITECTURE.md', 'EIS Data Migration Architecture', [
  'Classify: PRE_EIS · LEGACY_EFD · LEGACY_EIS_* · REQUIRES_MAPPING · REQUIRES_MRA_GUIDANCE · NOT_ELIGIBLE · MANUAL_REVIEW',
  '',
  'No auto historical submit; no invent acceptance; no new fiscal numbers for history; dry-run batches; no Journal mutation.',
]);

doc('EIS_TEST_ARCHITECTURE.md', 'EIS Test Architecture', [
  'Layers: static architecture · unit (policies/SM/crypto KAT) · DB constraints/isolation · integration (adapters/outbox/worker) · contract (fixtures/sandbox) · security · failure · concurrency · e2e.',
  '',
  'Blocked algorithms: tests assert "not implemented" until vectors exist.',
]);

doc('EIS_ARCHITECTURAL_INVARIANTS.md', 'EIS Architectural Invariants', [
  'Invariants 1–30 from Phase 3 prompt are adopted as executable future tests.',
  '',
  'Additional:',
  '31. EligibleSaleFinalized does not call posting engine.',
  '32. Browser bundles do not import TerminalCredentialVault or MraEisClient.',
  '33. FiscalNumberAllocator refuses to run until algorithmVersion verified.',
]);

doc('EIS_IMPLEMENTATION_DEPENDENCY_GRAPH.md', 'EIS Implementation Dependency Graph', [
  '```',
  'Phase1 clarifications (crypto/number/terminal/offline)',
  '        \\',
  'Phase2 blockers (idempotency, secrets, outbox drain, session, entitlement fix)',
  '         \\',
  'Phase4 Entitlement/flags ──> Phase5 Schema/SMs ──> Phase6 Crypto/Vault',
  '                              └─> Phase7 Activation (needs vault + terminal ID answer)',
  'Phase8 Config sync ──> Phase9 Mappings ──> Phase10 Product sync',
  'Phase11 Eligibility adapters ──> Phase12 Snapshot+numbering ──> Phase13 Online transmit',
  'Phase14 Receipt/QR ──> Phase15 Retry/recon ──> Phase16 Offline(gated)',
  'Phase17 Blocks ──> Phase18 Admin UI/reports ──> Phase19 Migration ──> Phase20 Tests ──> Phase21 Cert/rollout',
  '```',
]);

doc('EIS_IMPLEMENTATION_WAVES.md', 'EIS Implementation Waves', [
  '| Phase | Focus | Hard deps | Blocked if |',
  '|---|---|---|---|',
  '| 4 | Entitlement + ops controls + flags | P2 entitlement/session fixes recommended | — |',
  '| 5 | Schema + aggregates + SMs | Phase 3 blueprint | — |',
  '| 6 | Vault + crypto foundation | Encryption key ops | message-hash still interface-only |',
  '| 7 | Terminal activation | Vault + MAC/SaaS answer | Q-016/017 |',
  '| 8 | Config sync | Active terminal | — |',
  '| 9 | Site/tax/payment maps | Config | payment enums RC |',
  '| 10 | Product sync/map | Config | GET/POST clarified |',
  '| 11 | Eligibility adapters + sale idempotency | Maps | — |',
  '| 12 | Snapshot + fiscal numbering | Number KAT | **Q-021** |',
  '| 13 | Online transmission worker | Snapshot + client | hash if required |',
  '| 14 | Receipt/QR projection | Accept path | — |',
  '| 15 | Retry/unknown/recon | Transmit | — |',
  '| 16 | Offline | Cert + KAT + agent | **BLOCKED now** |',
  '| 17 | Terminal block | Transmit | — |',
  '| 18 | Admin/UI/reports/obs | Prior | — |',
  '| 19 | Migration | Policy | No auto history |',
  '| 20 | Full test/security | Prior | — |',
  '| 21 | Sandbox cert + pilot + prod | MRA approval | — |',
]);

// ADRs
doc('adr/README.md', 'Architecture Decision Records', [
  'ADRs ADR-001 … ADR-020 document Phase 3 decisions.',
]);

adr(
  '001',
  'MRA-EIS-BOUNDED-CONTEXT',
  'MRA EIS Bounded Context',
  'Introduce dedicated MraEis context that references but does not own Sale/Journal/Inventory.',
  'Need isolation of MRA DTOs and compliance lifecycle from accounting.',
  'Embed EIS fields on Sale only — rejected (couples status, weak idempotency).',
  'Clear ownership; more tables; adapters required.',
  '4–5+',
  'Phase 2 handover; Phase 1 contract pack'
);

adr(
  '002',
  'TWO-LEVEL-ENTITLEMENT',
  'Two-Level Entitlement',
  'Platform/System Admin entitlement separate from tenant operational enable/pause; effective capability computed.',
  'Master prompt + subscription plans exist with bugs.',
  'Single Boolean — rejected.',
  'Safe disable with history retention.',
  '4',
  'Phase 2 EIS_ENTITLEMENT_READINESS'
);

adr(
  '003',
  'SEPARATE-TRANSMISSION-AGGREGATE',
  'Separate Transmission Aggregate',
  'EIS status lives on Transmission (+ receipt projection), not Sale.status.',
  'Accounting vs compliance outcomes must diverge.',
  'Overload Sale.status — rejected.',
  'UI must show dual status.',
  '5,13,14',
  'Phase 2 FUTURE_TRANSMISSION_STATE'
);

adr(
  '004',
  'ACCOUNTING-INDEPENDENCE',
  'Accounting Independence',
  'Local posting succeeds without MRA; EIS never posts Journals or mutates stock.',
  'Avoid duplicate financial effects and outage coupling.',
  'Two-phase commit with MRA — rejected.',
  'Pending EIS after posted sale is normal.',
  '11–13',
  'Phase 2 posting engine audit'
);

adr(
  '005',
  'TRANSACTIONAL-OUTBOX',
  'Transactional Outbox',
  'Persist EIS Outbox events atomically with snapshot; durable dispatcher required.',
  'AcctV2Outbox undrained; post-commit submit unsafe.',
  'Fire-and-forget after commit — rejected for production.',
  'Need worker infra.',
  '5,13',
  'Phase 2 TRANSACTIONAL_OUTBOX_AUDIT'
);

adr(
  '006',
  'IMMUTABLE-FISCAL-SNAPSHOT',
  'Immutable Fiscal Snapshot',
  'Freeze all fiscal inputs at queue time; retries use snapshot only.',
  'Mutable masters would corrupt retries.',
  'Rebuild from Sale at send time — rejected.',
  'Storage growth; edit locks after snapshot.',
  '12–13',
  'Phase 2 FUTURE_EIS_SNAPSHOT'
);

adr(
  '007',
  'DATABASE-IDEMPOTENCY',
  'Database Idempotency',
  'Unique constraints on snapshot/transmission/fiscalNumber/attempts; app checks insufficient.',
  'POS lacks server idempotency today.',
  'Redis-only — rejected as sole control.',
  'Requires schema.',
  '5,11,12',
  'Phase 2 IDEMPOTENCY_AUDIT'
);

adr(
  '008',
  'FISCAL-SEQUENCE',
  'Fiscal Sequence Allocation',
  'DB row-locked per-terminal daily sequence; algorithm versioned; blocked until KAT.',
  'Guide Base64/Julian vs legacy decimal.',
  'In-memory counter — rejected.',
  'Cannot ship numbering until Q-021.',
  '12',
  'Phase 1 FISCAL_NUMBERING; Phase 2 gap G2-007'
);

adr(
  '009',
  'PER-TERMINAL-ORDERING',
  'Per-Terminal Ordering',
  'Partition transmission/config work by terminalId; parallel across terminals.',
  'Last-online/offline and sequence semantics are terminal-scoped.',
  'Global tenant lock — rejected.',
  'Fairness controls needed.',
  '13,15',
  'Phase 1 + Phase 2 concurrency'
);

adr(
  '010',
  'UNKNOWN-OUTCOME-RECONCILIATION',
  'Unknown Outcome Reconciliation Before Retry',
  'Timeouts after dispatch enter UNKNOWN_OUTCOME and reconcile before resend; reuse fiscal identity.',
  'Phase 1 timeout research.',
  'Blind retry — rejected.',
  'Needs last-online matching quality.',
  '15',
  'Phase 1 TIMEOUT research'
);

adr(
  '011',
  'SERVER-ONLY-CREDENTIALS',
  'Server-Only Credentials',
  'Vaulted encrypted JWT/secretKey; never browser/outbox/logs.',
  'settings.token plaintext blocker.',
  'Store in TenantSettings plaintext — rejected.',
  'Vault + key management ops.',
  '6–7',
  'Phase 2 SECRET_MANAGEMENT'
);

adr(
  '012',
  'VERSIONED-CONFIGURATION',
  'Versioned Configuration Snapshots',
  'Immutable config versions; one active; sales retain version refs.',
  'MRA config versions on invoice header.',
  'Overwrite latest only — rejected.',
  'Storage of history.',
  '8',
  'Phase 1 CONFIGURATION_CONTRACT'
);

adr(
  '013',
  'VERSIONED-MAPPINGS',
  'Versioned Product Tax Payment Mappings',
  'Mappings versioned; snapshots freeze versions; changes do not rewrite history.',
  'No mapping tables today.',
  'Store MRA code only on Product — rejected.',
  'New mapping UX.',
  '9–10',
  'Phase 2 product/tax audits'
);

adr(
  '014',
  'RECEIPT-STATUS-PROJECTION',
  'Receipt Status Projection',
  'Separate receipt EIS projection; pending ≠ validated; QR from MRA URL when accepted.',
  'Current QR is /verify.',
  'Always wait for MRA before any receipt — optional policy, not default.',
  'Async UX complexity.',
  '14',
  'Phase 2 QR audit'
);

adr(
  '015',
  'OFFLINE-CERTIFICATION-GATE',
  'Offline Certification Gate',
  'Offline fiscalization disabled until MRA cert + KAT + secure agent; browser queue not MRA offline.',
  'Phase 2 PARTIALLY_READY / not feasible for secrets.',
  'Enable browser offline with secretKey — rejected.',
  'Online-only MVP.',
  '16',
  'Phase 1+2 offline'
);

adr(
  '016',
  'TERMINAL-BLOCK-ENFORCEMENT',
  'Terminal Block Enforcement',
  'Server-side block stops claims/snapshots; no bypass; offline default denied.',
  'shouldBlockTerminal flag.',
  'Client-only disable — rejected.',
  'Cashier messaging required.',
  '17',
  'Phase 1 TERMINAL_BLOCKING'
);

adr(
  '017',
  'ENVIRONMENT-SEPARATION',
  'Environment Separation',
  'Sandbox vs production terminals/credentials/clients strictly separated; env on terminal+transmission.',
  'Dual OpenAPI bases.',
  'Shared credentials — rejected.',
  'Duplicate setup effort.',
  '4,7,13',
  'Phase 1 environments'
);

adr(
  '018',
  'NO-AUTOMATIC-HISTORICAL-SUBMISSION',
  'No Automatic Historical Submission',
  'Pre-activation sales never auto-submitted; migration is manual/controlled.',
  'Legal/cert risk.',
  'Backfill all history — rejected.',
  'PRE_EIS classification.',
  '19',
  'Phase 2 data assessment'
);

adr(
  '019',
  'EIS-REPORTING-BOUNDARY',
  'EIS Reporting Boundary',
  'EIS reports compliance/transmission health; accounting reports remain authoritative for money.',
  'Avoid dual books.',
  'Revenue from EIS accepted only — rejected.',
  'Clear UI labeling.',
  '18',
  'Principles'
);

adr(
  '020',
  'NO-UNDOCUMENTED-CORRECTIONS',
  'No Undocumented Corrections',
  'Use only verified void/credit-debit APIs; inventing negative sales forbidden; unclear refunds stay MANUAL_REVIEW.',
  'Phase 1 incomplete correction matrix.',
  'Mirror local void to invent MRA payload — rejected.',
  'Some flows blocked until MRA answers.',
  '15+',
  'Phase 1 corrections research'
);

doc('PHASE_3_ARCHITECTURE_RISK_REGISTER.md', 'Phase 3 Architecture Risk Register', [
  '| ID | Risk | Sev | Blocking phase |',
  '|---|---|---|---|',
  '| AR-001 | Message-hash unknown | CRITICAL | 13 |',
  '| AR-002 | Fiscal number algorithm unreproduced | CRITICAL | 12 |',
  '| AR-003 | SaaS terminal identity | CRITICAL | 7 |',
  '| AR-004 | Activation timeout recovery | HIGH | 7 |',
  '| AR-005 | Offline infeasible in browser | HIGH | 16 |',
  '| AR-006 | Outbox dispatcher missing today | CRITICAL | 13 |',
  '| AR-007 | POS idempotency gap | CRITICAL | 11 |',
  '| AR-008 | Secret plaintext in settings | CRITICAL | 6 |',
  '| AR-009 | Payment enum unknown | HIGH | 9/13 |',
  '| AR-010 | Correction workflow gaps | HIGH | 15+ |',
  '| AR-011 | Float money drift | HIGH | 12 |',
  '| AR-012 | Multi-replica sequence race if misimplemented | CRITICAL | 12 |',
  '| AR-013 | Certification delay | MED | 21 |',
  '| AR-014 | hasEISAccess bug | HIGH | 4 |',
  '| AR-015 | Tenant switch session downgrade | CRITICAL | 4 |',
]);

doc('PHASE_4_HANDOVER.md', 'Phase 4 Handover', [
  '## Phase 4 scope',
  '',
  'Platform EIS switch · System Admin entitlement grant/suspend/revoke · Tenant availability · Operational enable/pause · Environment authorization · Certification gating hooks · `EisEffectiveCapability` policy service · Permissions · Audit events · Admin/tenant APIs/UI · Queue-drain disable policy · Feature flags · Tests',
  '',
  '## Approved for Phase 4',
  '',
  '- Two-level entitlement + state machines',
  '- Feature flag precedence',
  '- Permission names (system.eis.* / eis.*)',
  '- Effective capability computation',
  '- No production transmission worker yet',
  '- No terminal activation in Phase 4 unless separately approved',
  '',
  '## Do not in Phase 4',
  '',
  'Real TAC activation · fiscal submit · QR MRA validated · offline · speculative HMAC message-hash',
  '',
  '## Preconditions preferred',
  '',
  'Fix hasEISAccess + tenant-switch session signing (Phase 2 blockers) in same wave or immediately before.',
  '',
  '## Acceptance',
  '',
  'Entitlement changes audited; effectiveEnabled false without entitlement; tenant cannot self-entitle; suspend stops new fiscalization flags; history retained on disable.',
]);

doc('PHASE_3_READINESS_DECISION.md', 'Phase 3 Readiness Decision', [
  '## Decision',
  '',
  '# READY_FOR_PHASE_4_WITH_BLOCKERS',
  '',
  '## Why',
  '',
  'Target architecture is complete and consistent for entitlement (Phase 4) and subsequent design-backed waves. Fiscal numbering, message-hash, SaaS terminal identity, offline, and several Phase 2 engineering remediations remain blockers for later waves — not for starting Phase 4 entitlement work.',
  '',
  '## External blockers',
  '',
  'Q-010–012 message-hash · Q-016 activation recovery · Q-017–019 terminal identity · Q-021 fiscal number · Q-040 offline KAT · Q-037/038 refunds · auth header',
  '',
  '## Internal blockers',
  '',
  'Outbox dispatcher · POS/invoice idempotency · vault plaintext · hasEISAccess · session switch · Float→decimal for snapshots',
  '',
  '## Next action',
  '',
  'Proceed to **Phase 4** entitlement implementation per PHASE_4_HANDOVER.md; keep fiscalization waves gated.',
]);

doc('FINAL_PHASE_3_ARCHITECTURE_REPORT.md', 'Final Phase 3 Architecture Report', [
  '## 1. Executive summary',
  '',
  'MraEis is a compliance bounded context. Eligible POS/Invoice finalizations emit `EligibleSaleFinalized`, create an immutable snapshot and Outbox event beside local accounting (no MRA I/O in that transaction), and transmit asynchronously. Accounting/stock remain single-effect. Credentials server-only. Offline gated. Historical sales not auto-submitted. Decision: **READY_FOR_PHASE_4_WITH_BLOCKERS**.',
  '',
  '## 2–8. Inputs, principles, context, modules',
  '',
  'See REQUIREMENT_TRACEABILITY_MATRIX, ARCHITECTURAL_PRINCIPLES, BOUNDED_CONTEXT, CONTEXT_MAP, TARGET_MODULE_STRUCTURE.',
  '',
  '## 9–23. Entitlement through mappings',
  '',
  'Two-level entitlement; env/cert gates; terminal aggregate; vault; immutable configs; site/product/tax/payment mappings versioned.',
  '',
  '## 24–39. Eligibility, event, snapshot, numbering, transmission, outbox, workers',
  '',
  'EligibleSaleFinalized; accounting independence; immutable snapshot; DB fiscal sequence (algorithm blocked until KAT); transmission SM; attempts; Outbox+dispatcher; per-terminal ordering; DB idempotency.',
  '',
  '## 40–55. Client, crypto, online, recovery, receipt, B2B, VAT5, offline, recon, reports',
  '',
  'Server client; crypto interfaces with blocks; online flow Option B pending UX; unknown→reconcile; receipt projection; B2B/VAT5; offline not currently feasible in browser; recon never touches Journals; EIS reports ≠ accounting books.',
  '',
  '## 56–75. Permissions through migration/tests',
  '',
  'See respective docs. ~26 entities; ≥20 constraints; 20 ADRs; waves 4–21.',
  '',
  '## 76–89. Dependency graph, waves, ADRs, risks, blockers',
  '',
  'See EIS_IMPLEMENTATION_*, adr/, PHASE_3_ARCHITECTURE_RISK_REGISTER, readiness decision.',
  '',
  '## 90–99. Confirmations',
  '',
  '- EIS creates no additional local accounting effect',
  '- Sales remain locally authoritative',
  '- Snapshots immutable for retries',
  '- Fiscal numbering uses DB concurrency (when unlocked)',
  '- Unknown outcomes reconcile before resubmit',
  '- Credentials backend-only',
  '- Tenant isolation required',
  '- Pending/rejected ≠ MRA Validated',
  '- Offline certification-gated',
  '- No automatic historical submission',
  '',
  '## 100–101. Decision & conclusion',
  '',
  '**READY_FOR_PHASE_4_WITH_BLOCKERS.** Architecture is implementation-ready for entitlement and scaffolding; production fiscalization remains gated on listed blockers.',
]);

// Update parent README
try {
  const parent = 'docs/mra-eis/README.md';
  let t = fs.readFileSync(parent, 'utf8');
  if (!t.includes('phase-3/')) {
    t = t.replace(
      '**Phase 2:** [phase-2/](./phase-2/) — READY_FOR_PHASE_3_WITH_BLOCKERS',
      '**Phase 2:** [phase-2/](./phase-2/) — READY_FOR_PHASE_3_WITH_BLOCKERS  \n**Phase 3:** [phase-3/](./phase-3/) — READY_FOR_PHASE_4_WITH_BLOCKERS'
    );
    t = t.replace(
      '1. **Phase 2:**',
      '1. **Phase 3:** [phase-3/README.md](./phase-3/README.md) → [FINAL_PHASE_3_ARCHITECTURE_REPORT.md](./phase-3/FINAL_PHASE_3_ARCHITECTURE_REPORT.md) → [PHASE_4_HANDOVER.md](./phase-3/PHASE_4_HANDOVER.md)\n2. **Phase 2:**'
    );
    fs.writeFileSync(parent, t);
  }
} catch (e) {
  console.warn('parent readme skip', e.message);
}

console.log('TOTAL', written.length);
fs.writeFileSync(path.join(__dirname, '_written.json'), JSON.stringify(written, null, 2));
console.log(written.filter((x) => x.startsWith('adr/')).length, 'adrs');
