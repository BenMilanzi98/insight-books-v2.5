/**
 * Phase 3 Target Architecture Pack — evidence-backed from Phase 1+2.
 * No production EIS code. No MRA calls. No credentials.
 * Date: 2026-07-22
 */
const fs = require('fs');
const path = require('path');

const ROOT = 'docs/mra-eis/phase-3';
const D = '2026-07-22';
const written = [];

function w(rel, body) {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(
    p,
    body.replace(/\n{3,}/g, '\n\n').trim() +
      '\n\n---\n*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*\n'
  );
  written.push(rel);
}

function doc(rel, title, lines) {
  w(rel, [`# ${title}`, '', `**Phase:** 3 — Target Architecture`, `**Date:** ${D}`, '', ...lines].join('\n'));
}

function adr(n, slug, title, decision, context, alternatives, consequences, phases, evidence) {
  doc(`adr/ADR-${n}-${slug}.md`, `ADR-${n}: ${title}`, [
    `**Status:** Accepted (conditional where noted)`,
    '',
    '## Context',
    '',
    context,
    '',
    '## Decision',
    '',
    decision,
    '',
    '## Alternatives considered',
    '',
    alternatives,
    '',
    '## Consequences',
    '',
    consequences,
    '',
    '## Implementation phases',
    '',
    phases,
    '',
    '## Evidence',
    '',
    evidence,
  ]);
}

// ========== CORE ==========
doc('README.md', 'Phase 3 — MRA EIS Target Architecture', [
  '## Decision',
  '',
  '**READY_FOR_PHASE_4_WITH_BLOCKERS** — see [PHASE_3_READINESS_DECISION.md](./PHASE_3_READINESS_DECISION.md)',
  '',
  '## One-line architecture',
  '',
  'EIS is a **server-side compliance bounded context** that consumes `EligibleSaleFinalized`, creates an **immutable fiscal snapshot + Outbox event** in the same DB transaction as local Sale finalization/accounting, transmits asynchronously via a durable worker, and never posts Journals or mutates stock.',
  '',
  '## Start here',
  '',
  '1. [FINAL_PHASE_3_ARCHITECTURE_REPORT.md](./FINAL_PHASE_3_ARCHITECTURE_REPORT.md)',
  '2. [PHASE_4_HANDOVER.md](./PHASE_4_HANDOVER.md)',
  '3. [EIS_IMPLEMENTATION_WAVES.md](./EIS_IMPLEMENTATION_WAVES.md)',
  '4. [adr/](./adr/)',
  '',
  '## Hard blockers still open (do not ship fiscalization)',
  '',
  '- Phase 1: message-hash, fiscal Base64 KAT, SaaS terminal identity, offline KAT, auth header, refund/return matrix',
  '- Phase 2: POS/invoice request idempotency, outbox dispatcher, plaintext settings tokens, hasEISAccess bug, tenant-switch session, Float money',
]);

const taskList = [
  'A Input evidence review',
  'B Requirement traceability',
  'C Bounded-context design',
  'D Context map',
  'E Module dependencies',
  'F Entitlement model',
  'G Tenant operational settings',
  'H Platform kill switch',
  'I Environment controls',
  'J Certification controls',
  'K Terminal aggregate',
  'L Terminal credentials',
  'M Terminal activation SM',
  'N Configuration aggregate',
  'O Configuration sync',
  'P Site/branch mapping',
  'Q Product/service mapping',
  'R Tax/levy mapping',
  'S Payment-method mapping',
  'T Sales eligibility',
  'U Canonical fiscal event',
  'V Immutable snapshot',
  'W Fiscal numbering',
  'X Transmission aggregate',
  'Y Transmission attempts',
  'Z Outbox',
  'AA Queue',
  'AB Worker',
  'AC Ordering',
  'AD Idempotency',
  'AE Concurrency',
  'AF Online transmission',
  'AG Unknown outcomes',
  'AH Retry',
  'AI Circuit breaker',
  'AJ Config refresh',
  'AK Terminal blocking',
  'AL Receipt/QR',
  'AM POS boundary',
  'AN Invoice boundary',
  'AO B2B',
  'AP VAT5',
  'AQ Offline',
  'AR Reconciliation',
  'AS Reports',
  'AT Permissions',
  'AU Approvals',
  'AV Audit',
  'AW Logging',
  'AX Metrics/alerts',
  'AY API client',
  'AZ Retention',
  'BA Privacy',
  'BB Database schema',
  'BC Constraints',
  'BD Indexes',
  'BE Read models',
  'BF Cache',
  'BG File storage',
  'BH Migration',
  'BI Backward compatibility',
  'BJ Feature flags',
  'BK Testing',
  'BL Certification readiness',
  'BM Rollout',
  'BN Rollback',
  'BO Implementation waves',
  'BP Phase 4 handover',
  'BQ Risk register',
  'BR Final report',
];

doc('PHASE_3_TASKS.md', 'Phase 3 Task Tracker', [
  '| Task ID | Workstream | Status | Output |',
  '|---|---|---|---|',
  ...taskList.map((t, i) => `| P3-${String(i + 1).padStart(3, '0')} | ${t} | COMPLETE (architecture draft) | Matching *.md / adr/ |`),
]);

doc('REQUIREMENT_TRACEABILITY_MATRIX.md', 'Requirement Traceability Matrix', [
  '| Arch decision | Phase 1 evidence | Phase 2 evidence | Conditional? |',
  '|---|---|---|---|',
  '| Bounded context MraEis | Contract pack | Handover | No |',
  '| Two-level entitlement | Master prompt | EIS_ENTITLEMENT_READINESS | Fix hasEISAccess |',
  '| EligibleSaleFinalized | Sales contract | Event candidates | No |',
  '| Snapshot+Outbox in finalize tx | Idempotency/timeout research | Outbox undrained; post-commit EIS | Need dispatcher |',
  '| No MRA call in financial tx | Principles | POS/Invoice audit | No |',
  '| Server-only credentials | Auth/crypto research | SECRET_MANAGEMENT | Encrypt settings.token |',
  '| Fiscal sequence DB lock | Fiscal numbering contract | Multi-replica risk | Algorithm KAT blocked |',
  '| Unknown outcome reconcile | Last-online research | Retry audit | No |',
  '| x-eis-message-hash | Absent OpenAPI | — | **BLOCKED** |',
  '| Offline signing | Offline KAT missing | PARTIALLY_READY | **BLOCKED** |',
  '| SaaS MAC/terminal | Clarification Q-017–19 | Identity audit | **BLOCKED** |',
  '| Receipt pending≠validated | Receipt/QR requirements | QR = /verify | No |',
  '| No historical auto-submit | Certification/migration | Data assessment | No |',
  '| Corrections only via verified APIs | Credit/void endpoints | Void/refund no EIS | Partial |',
]);

doc('ARCHITECTURAL_PRINCIPLES.md', 'Architectural Principles', [
  '1–40 as stated in Phase 3 prompt are adopted.',
  '',
  'InsightBooks-specific additions:',
  '',
  '41. Tenant = Business (`tenantId` / `businessId` alias) until a true multi-business tenant model exists.',
  '42. Prefer extending `AcctV2Outbox` + dispatcher over inventing a second undrained outbox — or dedicated `MraEisOutbox` with identical atomic claim semantics.',
  '43. Replace post-commit `eisService.submitInvoice` fire-and-forget; keep accounting independence.',
  '44. Money in fiscal snapshots must use decimal strings / Decimal types — not IEEE Float from Sale rows without normalization.',
]);

doc('MRA_EIS_BOUNDED_CONTEXT.md', 'MRA EIS Bounded Context', [
  '## Name',
  '',
  '**MraEis** (module path proposal: `lib/mraEis/` + `app/api/mra-eis/` — adapt to repo conventions).',
  '',
  '## Owns',
  '',
  'Entitlements · Business EIS settings · Terminals · Credential references · Config snapshots · Sites/mappings · External product catalogue copies · Product/tax/payment mappings · Fiscal sequences · Snapshots · Transmissions/attempts/responses · Receipt EIS projections · Offline queue · Reconciliation · Certification records · EIS read models/reports',
  '',
  '## Does not own',
  '',
  'Customer · Product · Sale · Invoice · Payment · Inventory · StockMovement · Journal · GL · Trial Balance · local Tax accounting',
  '',
  '## Anti-corruption',
  '',
  '- Inbound: `EligibleSaleFinalized` from POS/Invoice adapters (local IDs + frozen totals).',
  '- Outbound: versioned `MraEisClient` maps snapshot → MRA DTO; MRA DTO never becomes Sale model.',
  '- Accounting: references `journalEntryId` / registry identity only; never calls posting engine for EIS retries.',
]);

doc('MRA_EIS_CONTEXT_MAP.md', 'MRA EIS Context Map', [
  '| Upstream | Downstream | Exchange | Boundary |',
  '|---|---|---|---|',
  '| System Admin / Subscriptions | MraEis | Entitlement commands | Platform API |',
  '| Tenant settings | MraEis | Operational enable/pause | Policy service |',
  '| AuthN/AuthZ / SecV2 | MraEis | Actor, permissions, approvals | Shared |',
  '| POS | MraEis | PosSaleFinalized → EligibleSaleFinalized | Adapter |',
  '| Invoices | MraEis | SalesInvoiceIssued → EligibleSaleFinalized | Adapter |',
  '| Accounting V2 | MraEis | journalEntryId, period | Reference only |',
  '| Inventory | MraEis | stockMovementIds | Reference only |',
  '| Tax Engine | MraEis | Stored tax on sale → mapping | Snapshot freeze |',
  '| Customers | MraEis | Buyer fields at finalize | Snapshot freeze |',
  '| Products | MraEis | Mapping resolution | Versioned map |',
  '| Outbox/Workers | MraEis | EIS_* events | Infra |',
  '| Receipt/PDF/Email | MraEis | Query receipt projection | Read |',
  '| MRA API | MraEis client | HTTP | Server-only |',
  '',
  'Dependency rule: operational modules emit events; MraEis consumes; receipt UI queries; MraEis never posts GL.',
]);

doc('TARGET_MODULE_STRUCTURE.md', 'Target Module Structure', [
  'Adapted to InsightBooks (JS-first, `lib/` + `app/api/`):',
  '',
  '```',
  'lib/mraEis/',
  '  domain/          # aggregates, SMs, errors, specs',
  '  application/     # commands, queries, policies, handlers',
  '  infrastructure/  # prisma repos, vault, client, crypto, outbox, queue',
  '  contracts/       # EligibleSaleFinalized, DTOs (internal)',
  'app/api/mra-eis/   # tenant + admin routes (server)',
  'app/eis/           # existing UI — rewire gradually',
  'test/mraEis/       # unit/integration/contract/security',
  '```',
  '',
  'Do not put credential decryption or MraEisClient under `components/` or client bundles.',
]);

// Entitlement
doc('EIS_ENTITLEMENT_ARCHITECTURE.md', 'EIS Entitlement Architecture', [
  '## Two controls',
  '',
  '| Layer | Owner | Examples |',
  '|---|---|---|',
  '| Platform / System Admin | Platform | platformEnabled, tenant entitlement, sandbox/production permission, certification, emergency suspend |',
  '| Tenant operational | Tenant admin | enable/pause, default terminal, receipt wait policy, auto-retry bounds |',
  '',
  '## Effective capability (computed, not one Boolean)',
  '',
  '```',
  'EisEffectiveCapability {',
  '  platformEnabled, tenantEntitled, tenantEntitlementStatus,',
  '  businessOperationalEnabled, environmentAllowed, certificationApproved,',
  '  terminalActivated, credentialsUsable, configurationCurrent, mappingsComplete,',
  '  terminalBlocked, systemSuspended, effectiveEnabled, blockers[], warnings[]',
  '}',
  '```',
  '',
  'Reuse: `eis-monthly`/`eis-yearly` + `Tenant.eisEnabled` — **fix hasEISAccess** to query EIS plans explicitly (Phase 2 G2-004).',
  '',
  'Disablement: pause new claims → drain queue → DISABLED; **never delete** transmission history.',
]);

doc('ENTITLEMENT_AND_OPERATIONAL_STATE_MACHINES.md', 'Entitlement and Operational State Machines', [
  '## Tenant entitlement',
  '',
  '`NOT_ENTITLED → ENTITLEMENT_PENDING → ENTITLED_SANDBOX_ONLY → ENTITLED_PRODUCTION` · `SUSPENDED` · `REVOKED` · `EXPIRED`',
  '',
  'Actors: System Admin for grant/suspend/revoke/prod; audit + reason required.',
  '',
  '## Business operational (tenant=business)',
  '',
  '`UNAVAILABLE → AVAILABLE → SETUP_* → READY_FOR_ACTIVATION → ACTIVE → PAUSED → DISABLING_AFTER_QUEUE → DISABLED` · `DEGRADED` · `BLOCKED_BY_MRA` · `SUSPENDED_BY_SYSTEM` · `ERROR`',
  '',
  'Precedence: Platform kill > System suspension > Entitlement > Environment > Operational setting > Terminal/block/config/mappings.',
]);

doc('EIS_ENVIRONMENT_ARCHITECTURE.md', 'EIS Environment Architecture', [
  '| Env | Base URL | Credentials | Allowed |',
  '|---|---|---|---|',
  '| test/mock | mock server | fixtures | Contract tests |',
  '| sandbox | dev-eis-api.mra.mw | sandbox terminal | Cert prep |',
  '| production | eis-api.mra.mw | prod terminal | After cert + admin |',
  '',
  'Environment stored on **terminal + transmission**. Client cannot override. Sandbox terminal cannot use production client.',
]);

doc('EIS_CERTIFICATION_ARCHITECTURE.md', 'EIS Certification Architecture', [
  'Records: vendor, productID, productVersion, online/offline/receipt cert flags, dates, MRA refs, restrictions.',
  '',
  'Production activation requires: entitlement + prod env permission + valid cert + productID/version + active terminal + current config + mappings + readiness checks.',
  '',
  'Tenant cannot override certification.',
]);

doc('TERMINAL_AGGREGATE_DESIGN.md', 'Terminal Aggregate Design', [
  '## Properties',
  '',
  '`id, tenantId(=businessId), branchId?, siteMappingId, environment, mraTerminalId, terminalPosition, terminalLabel, productId, productVersion, platformIdentity, status, activation*, tokenExpiresAt, credentialReference, config versions, lastContact*, blocked*, offlineCertified, offlineLimits, version, timestamps`',
  '',
  '## Invariants',
  '',
  'One tenant; compatible branch/site; env immutable while ACTIVE; prod needs prod entitlement; unique mraTerminalId/position in verified scope; ACTIVE ⇒ confirmed + usable creds; blocked cannot submit; offline requires cert; **no plaintext secrets in aggregate**.',
  '',
  '## Conditional',
  '',
  'SaaS `platformIdentity` / MAC strategy — **BLOCKED pending MRA Q-017–019**. Safe default: do not activate production until clarified; store opaque `platformIdentity` from approved strategy only.',
]);

doc('TERMINAL_ACTIVATION_STATE_MACHINE.md', 'Terminal Activation State Machine', [
  'States: DRAFT → READINESS_INCOMPLETE → TAC_REQUIRED → ACTIVATION_REQUEST_PENDING → ACTIVATION_IN_PROGRESS → ACTIVATION_RESPONSE_RECEIVED → CREDENTIALS_PERSISTED → CONFIRMATION_PENDING → CONFIRMATION_IN_PROGRESS → ACTIVE · failures · TOKEN_EXPIRED · REACTIVATION_REQUIRED · BLOCKED · REVOKED',
  '',
  'Commands/events as in Phase 3 prompt.',
  '',
  '**Conditional:** activation timeout recovery (lost response after MRA activated) — Phase 1 Q-016 — mark ACTIVATION_FAILED / MANUAL_REVIEW; do not invent recovery endpoint.',
]);

doc('EIS_CREDENTIAL_ARCHITECTURE.md', 'EIS Credential Architecture', [
  'Vault interface: `store / getForTransmission / rotate / revoke`.',
  '',
  'Store JWT + secretKey via envelope encryption (extend `lib/encryption.js`; prefer AES-GCM later). References on Terminal; ciphertext in credential store.',
  '',
  'Never: browser, API responses, logs, audit plaintext, outbox/queue payloads, snapshots, reports.',
  '',
  'Migrate away from OAuth `clientId/clientSecret` and **plaintext `EISConfiguration.settings.token`** (Phase 2 blocker).',
  '',
  'TAC / buyer auth codes: short TTL, never logged.',
]);

doc('CONFIGURATION_AGGREGATE_DESIGN.md', 'Configuration Aggregate Design', [
  'Immutable snapshots: global / terminal / taxpayer (+ embedded taxrates, levies, offlineLimit).',
  '',
  'Fields: terminalId, environment, type, mraVersion, effective/received, checksum, parsed data, raw ref, validation, active flag, supersededAt.',
  '',
  'Never overwrite; one active per (terminal, type); snapshots on sales retain version refs.',
]);

doc('CONFIGURATION_SYNCHRONIZATION_ARCHITECTURE.md', 'Configuration Synchronization Architecture', [
  'Triggers: activation, schedule, manual, `shouldDownloadLatestConfig`, unblock, version mismatch.',
  '',
  'Lifecycle: REQUESTED→FETCHING→RECEIVED→VALIDATING→STORED→MAPPING_VALIDATION→ACTIVATED→COMPLETED · failure states.',
  '',
  'Terminal-scoped lock; pause new transmissions while stale if policy requires.',
]);

doc('SITE_AND_BRANCH_MAPPING_ARCHITECTURE.md', 'Site and Branch Mapping Architecture', [
  'Map: Tenant(=Business) + Branch (+ optional InventoryLocation) → mraTin + mraSiteId + terminal.',
  '',
  'Sale must resolve **exactly one** site; ambiguity blocks fiscalization. Historical snapshot freezes siteMappingId.',
]);

doc('MRA_PRODUCT_SERVICE_CATALOGUE_ARCHITECTURE.md', 'MRA Product Service Catalogue Architecture', [
  'Read-only sync of MRA site products/services (OpenAPI POST get-terminal-site-products preferred).',
  '',
  'Does not create local Products or stock/GL. Versioned sync runs; inactive codes remain for history.',
]);

doc('PRODUCT_SERVICE_MAPPING_ARCHITECTURE.md', 'Product Service Mapping Architecture', [
  'Local Product/Service ↔ MRA code; statuses UNMAPPED→…→ACTIVE/CONFLICT.',
  '',
  'Cross-tenant/business forbidden. Snapshot stores mappingVersion + resolved code. Changes do not mutate snapshots. Guessing codes forbidden.',
]);

doc('TAX_AND_LEVY_MAPPING_ARCHITECTURE.md', 'Tax and Levy Mapping Architecture', [
  'Local tax type/rate ↔ MRA taxRateId (+ levy). No hardcoded rates as permanent truth.',
  '',
  'Snapshot uses **stored sale tax amounts** + mapped MRA IDs. Material conflict blocks. VAT5 ≠ ordinary exemption.',
]);

doc('PAYMENT_METHOD_MAPPING_ARCHITECTURE.md', 'Payment Method Mapping Architecture', [
  'Map local keys (cash, airtel_money, …) → verified MRA enums (**Phase 1 RC** — conditional).',
  '',
  'Credit invoice fiscalizes once at issue; later payment ≠ new EIS sale. Split payment only if MRA representation verified.',
]);

console.log('p3-part1', written.length);
fs.writeFileSync(path.join(ROOT, '_written.json'), JSON.stringify(written, null, 2));
module.exports = { doc, adr, written, D, w };
