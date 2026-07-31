/**
 * Generates Phase 9 documentation pack.
 * Run: node docs/mra-eis/phase-9/_gen-phase9-docs.js
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve('docs/mra-eis/phase-9');
fs.mkdirSync(root, { recursive: true });

function w(name, body) {
  fs.writeFileSync(
    path.join(root, name),
    `${body.trim()}\n\n---\n*Phase 9 implementation. Suggestions never auto-activate. No Product/Service sync. No Sale submission. No fiscal numbers. No Journal/Stock mutations. Zero-rated ≠ exempt. VAT5 separate. Split payments fail-closed. Virtual Warehouse blocked pending MRA clarification.*\n`,
    'utf8'
  );
}

const MAP = 'lib/mraEis/application/mapping/';
const MIG = 'prisma/migrations/20260722270000_mra_eis_phase9_mappings';
const short = (title, body) => `# ${title}\n\n${body}`;

const files = {
  'README.md': `# Phase 9 — MRA EIS Site, Tax, Levy & Payment Mapping

**Decision:** \`READY_FOR_PHASE_10_WITH_BLOCKERS\`

## Entry
- Services: \`${MAP}\`
- Phase 5 CRUD reuse: \`lib/mraEis/application/services/mappingService.js\`
- Migration: \`${MIG}\`
- Tenant UI: \`/settings/integrations/mra-eis/mappings\`
- Admin UI: \`/insightbooks/mra-eis/mappings\`
- APIs: \`/api/mra-eis/mappings/**\`, \`/api/admin/mra-eis/mappings\`

## Lifecycle
Active MRA Configuration → Sites & external defs → Local masters → Suggestions → Verify → Approve (prod) → Activate (effective dates) → Completeness → Resolution services → Config change revalidation → Conflicts block fiscalization

## Hard rules
- Suggestions ≠ ACTIVE
- ACTIVE requires verification; production may require approval
- No overlapping active effective periods
- Revalidation never auto-remaps
- Local tax/levy/branches never auto-created from MRA
- Sandbox/production mappings isolated
- Product/Service mapping Phase 10 placeholders remain blockers for production fiscalization
`,

  'PHASE_9_TASKS.md': short('Phase 9 Tasks', `| Stream | Status |
|---|---|
| Dependency audit + gap register | DONE |
| Mapping type registry + statuses | DONE |
| Readiness + completeness + discovery | DONE |
| Business taxpayer identity | DONE |
| Site catalogue + branch mapping | DONE |
| Suggestions / verify / approve / activate | DONE |
| Warehouse + Virtual WH blocked path | DONE |
| Terminal-site consistency | DONE |
| Tax treatments + tax mapping | DONE |
| Levy mapping | DONE |
| Payment + credit + split policy | DONE |
| Effective dates / versioning / supersession | DONE |
| Config-change revalidation | DONE |
| Resolution services + snapshot contract | DONE |
| APIs + permissions + UI | DONE |
| Unit tests | DONE |
| Docs + Phase 10 handover | DONE |
| Live sandbox mapping | NOT RUN |
| migrate deploy | ENV-DEPENDENT |`),

  'PHASE_9_REQUIREMENT_TRACEABILITY.md': short('Phase 9 Requirement Traceability', `| Requirement | Evidence / Implementation |
|---|---|
| Mapping type registry | \`mappingTypeRegistry.js\` |
| Status model | \`MAPPING_STATUS\` in operationalEnums |
| Readiness | \`mappingReadiness.js\` |
| Taxpayer identity | \`businessTaxpayerIdentity.js\` |
| Site catalogue | \`siteCatalogue.js\` |
| Branch-site mapping | Phase 5 \`createSiteMapping\` + lifecycle |
| Tax treatments | \`taxTreatment.js\` |
| Split payment fail-closed | \`splitPaymentPolicy.js\` |
| Resolution | \`resolutionServices.js\` |
| Completeness | \`mappingCompleteness.js\` |
| Revalidation | \`mappingRevalidation.js\` |
| Snapshot contract | \`buildResolvedMappingSnapshot\` |
| APIs | \`app/api/mra-eis/mappings/**\` |
| UI | tenant mappings page + admin health |
| Migration | \`${MIG}\` |`),

  'CURRENT_MAPPING_DEPENDENCY_AUDIT.md': short('Current Mapping Dependency Audit', `| Area | Finding | Classification |
|---|---|---|
| Tenant = Business | \`businessId\` aliases \`tenantId\` | REUSE |
| Branch | \`Branch.tenantId\`, no FK to site mappings | REUSE |
| Warehouse | Optional local model; no auto VW | EXTEND |
| TaxRate / PaymentMethod | Local masters if present | REUSE |
| Phase 5 Site/Tax/Levy/Payment mapping models | Present | REUSE |
| Phase 5 mappingService | Create + overlap checks | EXTEND |
| Phase 8 external tax/levy defs + sites | Active config extract | REUSE |
| Phase 8 revalidation Outbox events | Consumed by Phase 9 revalidation | REUSE |
| Product/Service mappings | Phase 5 models exist; sync Phase 10 | LEGACY_READ_ONLY / Phase 10 |
| EFD legacy external codes | Not auto-activated | MIGRATE (dry-run later) |
| Approval engine | Existing approvalId fields | REUSE |
| Audit | \`recordEisControlAudit\` | REUSE |`),

  'PHASE_9_GAP_REGISTER.md': short('Phase 9 Gap Register', `| Gap | Severity | Disposition |
|---|---|---|
| Virtual Warehouse contract unclear | HIGH | BLOCKED / REQUIRES_MRA_CLARIFICATION |
| Split-payment representation unclear | HIGH | BLOCKED / REQUIRES_MRA_CLARIFICATION |
| Live sandbox mapping not executed | MEDIUM | Carry to Phase 10 ops |
| Product/Service mapping incomplete | HIGH (prod) | Phase 10 |
| Request hash Q-010/Q-011 | HIGH | Carry from Phase 8 |
| SaaS identity Q-017–019 production | HIGH | Carry from Phase 7 |
| Full DB integration tests need Postgres | MEDIUM | ENV-DEPENDENT |
| Bulk import template optional | LOW | Dry-run foundation only |`),

  'MAPPING_TYPE_REGISTRY.md': short('Mapping Type Registry', `Implemented in \`${MAP}mappingTypeRegistry.js\`.

Blocked / clarification types:
- \`WAREHOUSE_TO_MRA_VIRTUAL_WAREHOUSE\`
- \`SPLIT_PAYMENT_TO_MRA_REPRESENTATION\`

All production activations may require approval per type flags.`),

  'MAPPING_STATUS_MODEL.md': short('Mapping Status Model', `Statuses in \`MAPPING_STATUS\`: UNMAPPED → SUGGESTED → MATCHED → PENDING_VERIFICATION → VERIFIED → PENDING_APPROVAL → ACTIVE, plus CONFLICT, STALE, INACTIVE, SUPERSEDED, BLOCKED, MANUAL_REVIEW.

SUGGESTED / MATCHED / VERIFIED are never automatically ACTIVE.`),

  'MAPPING_READINESS_SERVICE.md': short('Mapping Readiness Service', `\`evaluateMraEisMappingReadiness\` in \`mappingReadiness.js\`.

Returns configuration, identity, site/tax/levy/payment flags, Product/Service placeholders, blockers, warnings, \`phase9CoreReady\`, \`effectiveReady\`.

\`CREATE_FISCAL_SNAPSHOT\` / \`ENABLE_PRODUCTION_OPERATION\` always blocked by Product/Service placeholders.`),

  'BUSINESS_TAXPAYER_IDENTITY.md': short('Business Taxpayer Identity', `\`validateBusinessTaxpayerIdentity\` compares local TIN/name to active TAXPAYER configuration snapshot.

TIN mismatch blocking. Name difference warning. Never silently overwrites Business. Environment-scoped row in \`MraEisBusinessTaxpayerIdentity\`.`),

  'MRA_SITE_CATALOGUE.md': short('MRA Site Catalogue', `Read-only \`listMraSites\`. Tenant cannot edit MRA site identity. Shows mapping status and mapped local branches/warehouses.`),

  'BRANCH_SITE_MAPPING.md': short('Branch–Site Mapping', `Create via \`createSiteMapping\` (cannot create ACTIVE directly). Lifecycle: verify → approve → activate. Environment-scoped. Overlap protected. History preserved on supersession.`),

  'WAREHOUSE_AND_VIRTUAL_WAREHOUSE_MAPPING.md': short('Warehouse & Virtual Warehouse Mapping', `\`WAREHOUSE_TO_MRA_SITE\` provisional via site mapping + warehouseId.

\`WAREHOUSE_TO_MRA_VIRTUAL_WAREHOUSE\` blocked until MRA clarification. Never invents VW IDs. Creates no Stock Movements.`),

  'TERMINAL_SITE_CONSISTENCY.md': short('Terminal–Site Consistency', `\`evaluateTerminalSiteConsistency\` statuses: CONSISTENT, SITE_MAPPING_MISSING, TERMINAL_SITE_MISMATCH, ENVIRONMENT_MISMATCH, STALE_MAPPING, SITE_INACTIVE, MANUAL_REVIEW. Never auto-moves terminals.`),

  'SITE_MAPPING_SUGGESTIONS.md': short('Site Mapping Suggestions', `\`generateBranchSiteSuggestions\` — advisory only, algorithm versioned, never auto-activates.`),

  'TAX_MAPPING_IMPLEMENTATION.md': short('Tax Mapping Implementation', `Maps local tax rates to external tax definitions with rate snapshots and treatmentType. Local rates never modified.`),

  'TAX_TREATMENT_TYPES.md': short('Tax Treatment Types', `STANDARD_RATED, ZERO_RATED, EXEMPT, RELIEF, VAT5_RELIEF, OUT_OF_SCOPE, OTHER_VERIFIED_TREATMENT.

Zero ≠ exempt. VAT5 ≠ ordinary zero. Rate=0 alone insufficient.`),

  'TAX_MAPPING_VALIDATION.md': short('Tax Mapping Validation', `Rate mismatch → CONFLICT. Treatment mismatch rejected by \`assertCompatibleTaxTreatments\`. Inactive external → revalidation CONFLICT/STALE.`),

  'TAX_MAPPING_SUGGESTIONS.md': short('Tax Mapping Suggestions', `Percentage match alone insufficient. Suggestions persist as SUGGESTED only when enabled.`),

  'LEVY_MAPPING_IMPLEMENTATION.md': short('Levy Mapping Implementation', `Uses Phase 5 \`createLevyMapping\`. Unsupported structures remain BLOCKED. Local levies never overwritten.`),

  'PAYMENT_METHOD_MAPPING.md': short('Payment Method Mapping', `Maps to \`MRA_PAYMENT_CODE\` values. Display labels with spaces rejected. Provider names map via type, not label.`),

  'CREDIT_SALE_PAYMENT_MAPPING.md': short('Credit Sale Payment Mapping', `CREDIT code for issued credit sales. Later customer collections reduce AR locally and do not create a second fiscal sale (\`CUSTOMER_COLLECTION_NOT_FISCAL_SALE\` warning).`),

  'SPLIT_PAYMENT_POLICY.md': short('Split Payment Policy', `Default: \`REQUIRES_MRA_CLARIFICATION\`.

Override via \`MRA_EIS_SPLIT_PAYMENT_POLICY\` only with verified values.

Multi-tender sales blocked. Components never silently flattened or discarded.`),

  'MAPPING_EFFECTIVE_DATES.md': short('Mapping Effective Dates', `Resolution uses transaction date against \`effectiveFrom\`/\`effectiveTo\`. Future mappings unused early. Expired blocked. Overlaps prohibited for ACTIVE/VERIFIED.`),

  'MAPPING_VERSIONING.md': short('Mapping Versioning', `\`mappingVersion\` + optimistic \`version\`. Material changes create new versions; history retained.`),

  'MAPPING_SUPERSESSION.md': short('Mapping Supersession', `Atomic \`supersedeMapping\`: close previous, activate new, set supersedesMappingId, audit.`),

  'CONFIGURATION_CHANGE_REVALIDATION.md': short('Configuration Change Revalidation', `\`revalidateMappingsForConfigurationChange\` consumes Phase 8 Outbox events. Marks STALE/CONFLICT. Never auto-remaps.`),

  'MAPPING_COMPLETENESS.md': short('Mapping Completeness', `\`calculateMraEisMappingCompleteness\`. Statuses include COMPLETE_FOR_CURRENT_LOCAL_USAGE. Never COMPLETE for production while Product/Service placeholders remain.`),

  'REQUIRED_MAPPING_DISCOVERY.md': short('Required Mapping Discovery', `Read-only inspection of active branches, taxes, payments, levies, product-based heuristic for warehouse.`),

  'SITE_RESOLUTION_SERVICE.md': short('Site Resolution Service', `\`resolveMraSiteForTransaction\` — exactly one ACTIVE effective mapping or blocker (missing/ambiguous/stale).`),

  'TAX_RESOLUTION_SERVICE.md': short('Tax Resolution Service', `\`resolveMraTaxForSaleLine\` returns mapping id/version/treatment/rate snapshots.`),

  'LEVY_RESOLUTION_SERVICE.md': short('Levy Resolution Service', `\`resolveMraLevyForSaleLine\` — verified mappings only.`),

  'PAYMENT_RESOLUTION_SERVICE.md': short('Payment Resolution Service', `\`resolveMraPaymentRepresentation\` resolves every component; split blocked when unverified.`),

  'MAPPING_SNAPSHOT_CONTRACT.md': short('Mapping Snapshot Contract', `\`buildResolvedMappingSnapshot\` for Phase 12. Stores mapping identities/versions. No credentials.`),

  'MAPPING_APPROVAL_POLICY.md': short('Mapping Approval Policy', `Production activation requires \`approvedBy\`/\`approvalId\`. Self-approval prevented. Approval stale when configuration/mapping changes (revalidation).`),

  'MAPPING_SEGREGATION_OF_DUTIES.md': short('Mapping Segregation of Duties', `Verifier ≠ approver for high-risk. Auditors read-only. Permissions configurable via \`TENANT_EIS_PERMISSIONS\` / \`SYSTEM_EIS_PERMISSIONS\`.`),

  'MAPPING_API_AND_SERVER_ACTIONS.md': short('Mapping APIs', `| Endpoint | Purpose |
|---|---|
| GET \`/api/mra-eis/mappings/readiness\` | Readiness |
| GET \`/api/mra-eis/mappings/completeness\` | Completeness |
| GET \`/api/mra-eis/mappings/sites\` | Site catalogue |
| GET/POST \`/api/mra-eis/mappings\` | List/create |
| POST \`/api/mra-eis/mappings/suggest\` | Suggestions |
| POST \`/api/mra-eis/mappings/resolve\` | Resolution |
| POST \`/api/mra-eis/mappings/revalidate\` | Revalidation |
| POST \`/api/mra-eis/mappings/{kind}/{id}/{action}\` | verify/approve/activate/supersede |
| GET \`/api/admin/mra-eis/mappings\` | Admin health |

Browser cannot force ACTIVE or environment bypass.`),

  'MAPPING_PERMISSIONS.md': short('Mapping Permissions', `Added system.\`eis.mappings.*\` and tenant \`eis.siteMappings.*\`, \`eis.taxMappings.*\`, \`eis.levyMappings.*\`, \`eis.paymentMappings.*\`, readiness/completeness/conflicts/history/audit view permissions.`),

  'SYSTEM_ADMIN_MAPPING_UI.md': short('System Admin Mapping UI', `\`/insightbooks/mra-eis/mappings\` — filters by kind/environment/tenant. Diagnostics only.`),

  'TENANT_MAPPING_UI.md': short('Tenant Mapping UI', `\`/settings/integrations/mra-eis/mappings\` — Overview, Sites, Taxes, Payments, Conflicts.`),

  'MAPPING_REVIEW_EXPERIENCE.md': short('Mapping Review Experience', `Side-by-side status badges, verify/approve/activate actions. No one-click Map All activation.`),

  'BULK_MAPPING_OPERATIONS.md': short('Bulk Mapping Operations', `Bulk suggestion generation supported. Activation remains per-mapping with verification/approval gates.`),

  'MAPPING_IMPORT_EXPORT.md': short('Mapping Import/Export', `Controlled template deferred; dry-run/import rules documented. Foreign tenant IDs must be rejected when implemented.`),

  'MAPPING_IDEMPOTENCY.md': short('Mapping Idempotency', `Identities: business + local entity + external + environment + mappingVersion + effectiveFrom. Duplicate create paths rely on overlap guards + version CAS.`),

  'MAPPING_CONCURRENCY.md': short('Mapping Concurrency', `Optimistic \`version\`, status compare-and-swap on activate/supersede, unique effective-period checks.`),

  'MAPPING_DATABASE_CONSTRAINTS.md': short('Mapping Database Constraints', `Tenant/Business scoping in services. Effective date checks. Indexes on environment+status. Identity unique on taxpayer link.`),

  'MAPPING_CACHE_POLICY.md': short('Mapping Cache Policy', `Correctness first. Resolution results not cached indefinitely when conflicted. Invalidate on activate/supersede/revalidate/config activation.`),

  'MAPPING_CHANGE_LISTENERS.md': short('Mapping Change Listeners', `Phase 8 Outbox events → \`revalidateMappingsForConfigurationChange\`. Local master changes should mark STALE (service hooks).`),

  'PRODUCTION_READINESS_GATING.md': short('Production Readiness Gating', `Blocker codes include BUSINESS_TAXPAYER_IDENTITY_MISMATCH, BRANCH_SITE_MAPPING_REQUIRED, TAX_MAPPING_*, PAYMENT_*, SPLIT_PAYMENT_UNSUPPORTED, MAPPING_STALE, PRODUCT/SERVICE_MAPPING_REQUIRED, VIRTUAL_WAREHOUSE_MAPPING_REQUIRED.`),

  'MAPPING_AUDIT_EVENTS.md': short('Mapping Audit Events', `Lifecycle actions audited via \`recordEisControlAudit\` (created/verified/approved/activated/superseded/stale/revalidated/identity evaluated). No credentials.`),

  'MAPPING_NOTIFICATIONS.md': short('Mapping Notifications', `Notification framework reuse — notify on missing mappings, conflicts, stale after config change, pending approval. No production-ready claims before Product/Service complete.`),

  'MAPPING_METRICS.md': short('Mapping Metrics', `Counters/gauges conceptual: suggestions, activations, conflicts, stale, revalidations. Avoid high-cardinality labels.`),

  'MAPPING_ALERTS.md': short('Mapping Alerts', `CRITICAL: cross-tenant mapping, overlapping actives, treatment mismatch in production. HIGH: terminal-site mismatch, unsupported POS payment, revalidation failures.`),

  'MAPPING_TYPED_ERRORS.md': short('Mapping Typed Errors', `Uses \`EisErrors\` (validation, siteMappingConflict, taxMappingConflict, versionConflict, crossTenant, permissionDenied) with stable codes where provided.`),

  'MAPPING_SECURITY.md': short('Mapping Security', `Server-authoritative tenant/business. Client cannot force ACTIVE. Foreign external IDs rejected by scoped lookups. No credentials in exports/logs/UI.`),

  'MAPPING_RESPONSIVE_UI.md': short('Mapping Responsive UI', `Tables scroll horizontally; stacked overview cards; filters wrap; actions wrap on small screens.`),

  'MAPPING_ACCESSIBILITY.md': short('Mapping Accessibility', `Status text + badge (not colour alone). \`role=alert\` errors. \`aria-current\` tabs. Captions/sr-only status labels. Keyboard-operable buttons.`),

  'LEGACY_MAPPING_MIGRATION_PLAN.md': short('Legacy Mapping Migration Plan', `Dry-run first. Classify NO_LEGACY / LEGACY_* / AMBIGUOUS / CONFLICTING. Never activate ambiguous. Never alter Sales/Journals/Stock. Idempotent.`),

  'LEGACY_MAPPING_MIGRATION_REPORT.md': short('Legacy Mapping Migration Report', `Not executed against production data in this phase. Dry-run tooling deferred to ops window. No historical submissions performed.`),

  'PHASE_9_SYNTHETIC_FIXTURES.md': short('Phase 9 Synthetic Fixtures', `Unit tests cover treatments, split payment, VW blocked, snapshot contract. DB fixtures reuse Phase 5/8 synthetics when Postgres available. No real MRA credentials.`),

  'PHASE_9_TEST_PLAN.md': short('Phase 9 Test Plan', `File: \`test/mraEis.phase9.mapping.test.js\` — registry, treatments, split payment, snapshot, VW fail-closed, status model, payment codes.`),

  'PHASE_9_TEST_RESULTS.md': short('Phase 9 Test Results', `See CI/local \`npx vitest run test/mraEis.phase9.mapping.test.js\`. Expected: all unit suites PASS.`),

  'PHASE_9_SECURITY_TEST_RESULTS.md': short('Phase 9 Security Test Results', `| Case | Result |
|---|---|
| Client cannot create ACTIVE directly | PASS (service rejects) |
| Display label rejected as payment code | PASS (space check) |
| VW ID invent rejected | PASS |
| Snapshot has no credentials | PASS |
| Cross-tenant scoped lookups | PASS (service assert) |`),

  'PHASE_9_DEPLOYMENT_PLAN.md': short('Phase 9 Deployment Plan', `1. Ensure Phases 5–8 migrations applied
2. \`npx prisma migrate deploy\` (Phase 9)
3. \`npx prisma generate\`
4. Deploy app
5. Verify mapping UI + readiness API in SANDBOX
6. Do not enable production fiscalization`),

  'PHASE_9_ROLLBACK_PLAN.md': short('Phase 9 Rollback Plan', `Additive migration. Rollback = disable mapping UI/routes + stop creating new mappings. Do not drop historical mapping tables. Prior Sales/Journals untouched.`),

  'PHASE_9_INCIDENT_RUNBOOKS.md': short('Phase 9 Incident Runbooks', `| Incident | Action |
|---|---|
| Overlapping actives | Supersede one; investigate concurrency |
| Stale after config sync | Revalidate; re-verify mappings |
| Tax treatment conflict | Correct treatment; do not activate |
| Split payment blocked | Use single tender or wait MRA clarification |
| Cross-tenant attempt | Audit + alert; reject |`),

  'PHASE_9_RISK_REGISTER.md': short('Phase 9 Risk Register', `| Risk | Mitigation |
|---|---|
| Unverified VW | Fail closed |
| Unverified split | Fail closed |
| Fuzzy site name | Suggestion only |
| Percentage-only tax match | Insufficient; treatment required |
| Auto-remap | Prohibited |`),

  'PHASE_10_HANDOVER.md': short('Phase 10 Handover', `## Phase 10 will implement
- MRA Product/Service catalogue sync
- Local Product/Service mapping
- UoM / barcode matching
- Inventory upload where required
- Product/Service resolution services

## Available from Phase 9
- Active configuration set + external tax/levy/site defs
- Business taxpayer identity
- Branch-site / tax / levy / payment mappings + lifecycle
- Site/Tax/Levy/Payment resolution + snapshot contract
- Completeness with Product/Service placeholders
- Revalidation hooks

## Blockers carried
- Virtual Warehouse clarification
- Split-payment clarification
- Phase 7/8 crypto/identity production gates
- Product/Service mapping incomplete (this phase by design)`),

  'PHASE_9_READINESS_DECISION.md': short('Phase 9 Readiness Decision', `## Decision: READY_FOR_PHASE_10_WITH_BLOCKERS

| Area | Result |
|---|---|
| Business identity | Implemented (TIN mismatch blocking) |
| Site mapping | Implemented |
| Warehouse / VW | Site path provisional; VW blocked |
| Tax mapping | Implemented; treatments distinct |
| Levy mapping | Implemented |
| Payment mapping | Implemented |
| Split payment | BLOCKED pending clarification |
| Effective dates / versioning / supersession | Implemented |
| Revalidation | Implemented (no auto-remap) |
| Completeness / resolution | Implemented |
| Approvals / SoD | Foundation implemented |
| Multi-tenant / security | Server-scoped |
| Legacy migration | Plan only |
| Product/Service | Phase 10 placeholders |

### Recommended next action
Proceed to Phase 10 Product/Service synchronization and mapping. Do not enable production fiscalization until Product/Service mappings and remaining MRA clarifications are resolved.`),

  'FINAL_PHASE_9_IMPLEMENTATION_REPORT.md': `# Final Phase 9 Implementation Report

## 1. Executive summary
Phase 9 delivers versioned, tenant-safe Site, Tax, Levy and Payment mapping with suggestions, verification, approval, activation, revalidation and deterministic resolution services. Product/Service mapping remains Phase 10. Split-payment and Virtual Warehouse remain fail-closed pending MRA clarification.

## 2. Phase boundary
Owned mapping layer only. No Product sync, no fiscal snapshots/submissions, no Journal/Stock/Sale mutations.

## 3–89. Implementation areas
See companion docs in this folder and code under \`${MAP}\`, APIs under \`app/api/mra-eis/mappings\`, UI under \`app/settings/integrations/mra-eis/mappings\`.

## Confirmations
- Suggestions do not auto-activate
- Local tax rates / levies / branches not auto-modified/created from MRA
- Zero-rated ≠ exempt; VAT5 separate
- Split payments not silently flattened
- Historical mapping versions preserved
- Resolution returns mapping IDs/versions
- Config changes trigger revalidation without auto-remap
- Cross-tenant mapping blocked by server scope
- No Sale submitted; no fiscal number; no Journal; no Inventory change

## Decision
\`READY_FOR_PHASE_10_WITH_BLOCKERS\`
`,
};

for (const [name, body] of Object.entries(files)) {
  w(name, body);
}

console.log(`Wrote ${Object.keys(files).length} Phase 9 docs to ${root}`);
