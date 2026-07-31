/**
 * Generates Phase 10 documentation pack.
 * Run: node docs/mra-eis/phase-10/_gen-phase10-docs.js
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve('docs/mra-eis/phase-10');
fs.mkdirSync(root, { recursive: true });

function w(name, body) {
  fs.writeFileSync(
    path.join(root, name),
    `${body.trim()}\n\n---\n*Phase 10 implementation. External catalogue ≠ local master data. Suggestions never auto-activate. No Sale/fiscal number/QR. No Journal/Stock/price/tax auto-mutation. Product sync method Q-003 blocked for production. Initial Inventory upload blocked until verified. Cross-type mappings blocked by default.*\n`,
    'utf8'
  );
}

const CAT = 'lib/mraEis/application/catalogue/';
const short = (title, body) => `# ${title}\n\n${body}`;

const files = {
  'README.md': `# Phase 10 — MRA Product & Service Catalogue Sync and Mapping

**Decision:** \`READY_FOR_PHASE_11_WITH_BLOCKERS\`

## Entry
- Services: \`${CAT}\`
- Mock: \`lib/mraEis/infrastructure/mraClient/mockMraCatalogueServer.js\`
- Client: \`catalogueClient.js\`
- Tenant UI: \`/settings/integrations/mra-eis/catalogue\`
- Admin UI: \`/insightbooks/mra-eis/catalogue\`
- APIs: \`/api/mra-eis/catalogue/**\`

## Hard rules
- External catalogue never auto-creates local Products/Services
- Sync never mutates local stock, prices, or taxes
- Suggestions never auto-activate
- Product sync HTTP method unresolved (Q-003) — production blocked; MOCK POST only
- Initial Inventory submission blocked until contract verified
- Cross-type Product↔Service blocked by default
- Bundles require MRA clarification
`,

  'PHASE_10_TASKS.md': short('Phase 10 Tasks', `| Stream | Status |
|---|---|
| Audit + gap register | DONE |
| Business type classification | DONE |
| Sync contract decisions | DONE (blocked/clarification) |
| Request/response/mock/client | DONE |
| Sync Run orchestrator | DONE |
| External storage + versioning | DONE |
| Discovery + suggestions | DONE |
| UOM / tax / cross-type / bundle | DONE |
| Product/Service resolution | DONE |
| Completeness | DONE |
| Inventory requirement + reconcile + blocked submit | DONE |
| APIs + UI + permissions | DONE |
| Unit tests | DONE |
| Docs + Phase 11 handover | DONE |
| Live sandbox catalogue sync | NOT RUN |
| Production Product sync | BLOCKED Q-003 |`),

  'PHASE_10_REQUIREMENT_TRACEABILITY.md': short('Phase 10 Requirement Traceability', `| Requirement | Implementation |
|---|---|
| Q-003 Product method | \`productSyncContract.js\` REQUIRES_MRA_CLARIFICATION |
| Business type | \`businessTypeClassification.js\` |
| Sync readiness | \`catalogueSyncReadiness.js\` |
| Sync orchestrator | \`catalogueSyncOrchestrator.js\` |
| Parser | \`catalogueResponseParser.js\` |
| Mock | \`mockMraCatalogueServer.js\` |
| Suggestions | \`productServiceSuggestions.js\` |
| Resolution | \`productServiceResolution.js\` |
| Completeness | \`productServiceCompleteness.js\` |
| Inventory | \`initialInventory.js\` |
| UOM | \`uomMapping.js\` |`),

  'CURRENT_PRODUCT_SERVICE_INVENTORY_AUDIT.md': short('Current Product/Service/Inventory Audit', `| Area | Finding | Class |
|---|---|---|
| Local Product | sku, barcode, taxRate, isService, stockLevel | REUSE |
| Local Service | Product.isService=true | REUSE |
| ProductVariant | No model | NOT_APPLICABLE |
| Warehouse | InventoryLocation + site mapping warehouseId | EXTEND |
| Stock | InventoryTransaction | REUSE (read-only for reconcile) |
| External catalogue | MraEisExternalCatalogueItem | REUSE/EXTEND |
| Product mapping | MraEisProductMapping | EXTEND |
| Sync Run | MraEisSyncRun | EXTEND |
| UOM | Unit / ProductUnit | REUSE |
| Phase 9 resolution | Site/Tax/Levy/Payment | REUSE |`),

  'PHASE_10_GAP_REGISTER.md': short('Phase 10 Gap Register', `| Gap | Severity | Disposition |
|---|---|---|
| Product sync GET vs POST (Q-003) | HIGH | REQUIRES_MRA_CLARIFICATION / production blocked |
| Request hash for catalogue | HIGH | Fail-closed outside MOCK |
| Full vs Delta semantics | HIGH | UNKNOWN — no partial inactivation |
| Initial Inventory endpoint | HIGH | BLOCKED |
| Virtual Warehouse | HIGH | Carry from Phase 9 |
| Split payment | HIGH | Carry from Phase 9 |
| ProductVariant model | MEDIUM | Explicit per-SKU mapping |
| Bundle treatment | MEDIUM | REQUIRES_MRA_CLARIFICATION |
| Live sandbox sync | MEDIUM | NOT RUN |`),

  'BUSINESS_EIS_TYPE_CLASSIFICATION.md': short('Business EIS Type Classification', `PRODUCT_BASED / SERVICE_BASED / MIXED / UNKNOWN / MANUAL_REVIEW via local sellable Product counts (\`isService\`). UNKNOWN blocks readiness.`),

  'CATALOGUE_SYNC_READINESS.md': short('Catalogue Sync Readiness', `\`evaluateCatalogueSyncReadiness\` — terminal, config, site mapping, contract, active sync guards.`),

  'CATALOGUE_SYNC_TRIGGERS.md': short('Catalogue Sync Triggers', `MANUAL, MRA_REQUESTED, POST_CONFIGURATION_ACTIVATION, RECOVERY, etc. Priority + idempotency key per terminal/type/trigger.`),

  'CATALOGUE_SYNC_RUN_IMPLEMENTATION.md': short('Catalogue Sync Run', `Extends \`MraEisSyncRun\` with PRODUCTS/SERVICES. Claim lease + execute stores external records only.`),

  'CATALOGUE_SYNC_STATE_MACHINE.md': short('Catalogue Sync State Machine', `QUEUED → CLAIMED → REQUEST_MAPPING → FETCHING → STORING_CATALOGUE → COMPLETED / COMPLETED_NO_CHANGES / COMPLETED_WITH_WARNINGS / FAILED / UNKNOWN_OUTCOME / MANUAL_REVIEW.`),

  'PRODUCT_SYNC_CONTRACT_DECISION.md': short('Product Sync Contract Decision', `**Status:** \`REQUIRES_MRA_CLARIFICATION\` (Q-003).

Preferred assumption for MOCK: **POST** \`/api/v1/utilities/get-terminal-site-products\`.

Production calls: **blocked**. No automatic GET↔POST fallback.`),

  'PRODUCT_REQUEST_MAPPER.md': short('Product Request Mapper', `\`mapProductCatalogueRequest\` — terminal, TIN, site, product identity, version. No local inventory quantities.`),

  'SERVICE_REQUEST_MAPPER.md': short('Service Request Mapper', `\`mapServiceCatalogueRequest\` — same endpoint assumption with \`externalType=SERVICE\`.`),

  'CATALOGUE_API_CLIENT.md': short('Catalogue API Client', `\`catalogueClient.js\` — MOCK only for live execution path; production blocked; POST only.`),

  'CATALOGUE_FETCH_ATTEMPTS.md': short('Catalogue Fetch Attempts', `Attempt metadata recorded via Sync Run counters + audit. No credentials logged.`),

  'PRODUCT_RESPONSE_PARSER.md': short('Product Response Parser', `Strict parser; HTTP 200 insufficient; version required; exact codes/barcodes; invalid decimals rejected.`),

  'SERVICE_RESPONSE_PARSER.md': short('Service Response Parser', `Same parser with SERVICE type; quantity not fabricated for services.`),

  'CATALOGUE_RESPONSE_CLASSIFICATION.md': short('Catalogue Response Classification', `Outcomes in \`CATALOGUE_RESPONSE_OUTCOME\` including TERMINAL_BLOCKED, SITE/TIN mismatch, METHOD_REJECTED, UNCHANGED, EMPTY_VALID.`),

  'EXTERNAL_PRODUCT_CATALOGUE.md': short('External Product Catalogue', `Stored in \`MraEisExternalCatalogueItem\` externalType=PRODUCT. Separate from local Products. Quantity/price/tax do not overwrite local.`),

  'EXTERNAL_SERVICE_CATALOGUE.md': short('External Service Catalogue', `externalType=SERVICE. No inventory fields fabricated.`),

  'CATALOGUE_VERSIONING.md': short('Catalogue Versioning', `sourceVersion + sourceChecksum. Same version different checksum → conflict/supersede prior.`),

  'CATALOGUE_REPLACEMENT_DELTA_POLICY.md': short('Catalogue Replacement vs Delta Policy', `**UNKNOWN**. Missing records never inactivated after partial pages or under unknown semantics.`),

  'CATALOGUE_ATOMIC_ACTIVATION.md': short('Catalogue Atomic Activation', `Per-run store with supersession of prior same-code actives when version changes. Partial failure does not inactivate unseen records.`),

  'LOCAL_PRODUCT_DISCOVERY.md': short('Local Product Discovery', `Read-only classification of sellable Products (\`isDeleted\`, stock, isService).`),

  'LOCAL_SERVICE_DISCOVERY.md': short('Local Service Discovery', `Products with \`isService=true\`.`),

  'PRODUCT_MAPPING_IMPLEMENTATION.md': short('Product Mapping', `\`createProductMapping\` + lifecycle PRODUCT. Cannot create ACTIVE directly. Inactive external blocked.`),

  'SERVICE_MAPPING_IMPLEMENTATION.md': short('Service Mapping', `localServiceId + SERVICE_TO_SERVICE. Lifecycle kind SERVICE.`),

  'CROSS_TYPE_MAPPING_POLICY.md': short('Cross-Type Mapping Policy', `PRODUCT_TO_SERVICE / SERVICE_TO_PRODUCT **BLOCKED** by default.`),

  'BARCODE_MATCHING.md': short('Barcode Matching', `Exact unique barcode → high confidence suggestion only. Duplicates → BARCODE_CONFLICT. Never auto-activate. Leading zeros preserved.`),

  'PRODUCT_SERVICE_CODE_MATCHING.md': short('Code Matching', `Exact and normalized code matches are advisory.`),

  'NAME_DESCRIPTION_MATCHING.md': short('Name/Description Matching', `Fuzzy name is low confidence and insufficient alone.`),

  'UNIT_OF_MEASURE_MAPPING.md': short('UOM Mapping', `\`buildUomConversionRule\` / \`convertQuantityToExternal\`. Labels ≠ codes. No local stock mutation.`),

  'PRODUCT_TAX_CONSISTENCY.md': short('Product Tax Consistency', `\`validateProductTaxConsistency\` vs Phase 9 tax mappings. Local tax never auto-changed.`),

  'PRODUCT_LEVY_CONSISTENCY.md': short('Product Levy Consistency', `Levy resolution hooks via Phase 9; local levies not auto-changed.`),

  'PRICE_COMPARISON_POLICY.md': short('Price Comparison Policy', `Compare only. Never overwrite local price lists.`),

  'DESCRIPTION_DIFFERENCE_POLICY.md': short('Description Difference Policy', `Material identity differences require review; names alone do not auto-block when other signals match.`),

  'PRODUCT_VARIANT_MAPPING_POLICY.md': short('Product Variant Mapping Policy', `No ProductVariant model. Each sellable SKU/barcode must map explicitly. No automatic collapse.`),

  'BUNDLE_AND_COMPOSITE_PRODUCT_POLICY.md': short('Bundle Policy', `REQUIRES_MRA_CLARIFICATION — blocked. No silent explode/flatten.`),

  'PRODUCT_MAPPING_SUGGESTIONS.md': short('Product Mapping Suggestions', `Weighted barcode/code/name. Never ACTIVE.`),

  'SERVICE_MAPPING_SUGGESTIONS.md': short('Service Mapping Suggestions', `Code/name/tax. No inventory signals required.`),

  'PRODUCT_SERVICE_MAPPING_REVIEW.md': short('Mapping Review', `Tenant catalogue UI side-by-side verify/activate. No Map-All activation.`),

  'PRODUCT_SERVICE_MAPPING_APPROVALS.md': short('Mapping Approvals', `Production activations may require approval via lifecycle; self-approval rules from Phase 9.`),

  'PRODUCT_SERVICE_EFFECTIVE_DATES.md': short('Effective Dates', `Resolution uses transaction date; overlaps prevented on activate.`),

  'PRODUCT_SERVICE_MAPPING_VERSIONING.md': short('Mapping Versioning', `mappingVersion + optimistic version retained.`),

  'PRODUCT_SERVICE_MAPPING_SUPERSESSION.md': short('Supersession', `Atomic supersede via Phase 9 lifecycle.`),

  'CATALOGUE_CHANGE_REVALIDATION.md': short('Catalogue Change Revalidation', `Outbox \`PRODUCT_MAPPING_REVALIDATION_REQUESTED\` emitted after sync. No auto-remap.`),

  'LOCAL_MASTER_DATA_REVALIDATION.md': short('Local Master Data Revalidation', `Local Product/tax/UOM changes should mark mappings STALE (service hooks).`),

  'PRODUCT_RESOLUTION_SERVICE.md': short('Product Resolution', `\`resolveMraProductForSaleLine\` — exact mapping/catalogue versions; no inventory effect.`),

  'SERVICE_RESOLUTION_SERVICE.md': short('Service Resolution', `\`resolveMraServiceForSaleLine\`.`),

  'PRODUCT_SERVICE_MAPPING_SNAPSHOT_CONTRACT.md': short('Item Mapping Snapshot Contract', `\`buildResolvedItemMappingSnapshot\` for Phase 12.`),

  'PRODUCT_SERVICE_COMPLETENESS.md': short('Completeness', `\`calculateProductServiceCompleteness\` — mixed requires both; never marks production-complete while inventory/VW blockers remain.`),

  'REQUIRED_LOCAL_ITEM_DISCOVERY.md': short('Required Local Item Discovery', `Read-only Business-scoped required Products/Services.`),

  'INITIAL_INVENTORY_REQUIREMENT.md': short('Initial Inventory Requirement', `Evaluates need; does not assume upload required. Contract unverified.`),

  'LOCAL_INVENTORY_SOURCE_OF_TRUTH.md': short('Local Inventory Source of Truth', `Local Inventory/Stock Movements authoritative. MRA quantity is compliance data only.`),

  'OPENING_INVENTORY_RECONCILIATION.md': short('Opening Inventory Reconciliation', `Read-only. No Journal/Stock Movement.`),

  'INITIAL_INVENTORY_SNAPSHOT.md': short('Initial Inventory Snapshot', `Immutable compliance snapshot evidence (checksummed). No accounting effects.`),

  'INITIAL_INVENTORY_SUBMISSION.md': short('Initial Inventory Submission', `Blocked provider until contract verified + feature flag.`),

  'INITIAL_INVENTORY_RESPONSE_EVIDENCE.md': short('Inventory Response Evidence', `HTTP alone insufficient; unknown outcomes do not blind-retry.`),

  'INVENTORY_DISCREPANCY_HANDLING.md': short('Inventory Discrepancy Handling', `Record differences; no auto-adjust.`),

  'INVENTORY_IDEMPOTENCY_AND_CONCURRENCY.md': short('Inventory Idempotency', `Snapshot checksum + submission idempotency key.`),

  'CATALOGUE_IDEMPOTENCY.md': short('Catalogue Idempotency', `Sync Run idempotencyKey; external identity+checksum.`),

  'CATALOGUE_CONCURRENCY.md': short('Catalogue Concurrency', `Per-run claim lease; no global product lock.`),

  'PHASE_10_DATABASE_CONSTRAINTS.md': short('Database Constraints', `Unique external identity on catalogue item; mapping indexes; service-enforced overlaps.`),

  'PHASE_10_PRODUCTION_READINESS.md': short('Production Readiness', `New blockers: PRODUCT/SERVICE_CATALOGUE_*, MAPPING_*, UOM_*, INITIAL_INVENTORY_*, VIRTUAL_WAREHOUSE_*, BUNDLE_*.`),

  'PHASE_10_SETUP_WIZARD.md': short('Setup Wizard', `Catalogue workspace covers business type, sync, mappings, inventory readiness steps via UI sections.`),

  'SYSTEM_ADMIN_CATALOGUE_UI.md': short('System Admin Catalogue UI', `\`/insightbooks/mra-eis/catalogue\`.`),

  'TENANT_CATALOGUE_UI.md': short('Tenant Catalogue UI', `\`/settings/integrations/mra-eis/catalogue\`.`),

  'BULK_PRODUCT_SERVICE_MAPPING.md': short('Bulk Mapping', `Bulk suggest only; activation remains per-mapping.`),

  'PRODUCT_SERVICE_IMPORT_EXPORT.md': short('Import/Export', `Controlled template deferred; foreign IDs must be rejected when implemented.`),

  'PHASE_10_PERMISSIONS.md': short('Permissions', `eis.catalogue.*, eis.productMappings.*, eis.serviceMappings.*, eis.uomMappings.*, eis.initialInventory.* + system counterparts.`),

  'PHASE_10_SEGREGATION_OF_DUTIES.md': short('Segregation of Duties', `Suggest/verify/approve/inventory roles via permissions; auditors read-only.`),

  'PHASE_10_AUDIT_EVENTS.md': short('Audit Events', `Sync requested/completed, suggestions, mapping lifecycle, inventory reconcile/snapshot/submit. No credentials. stockMutated=false.`),

  'PHASE_10_NOTIFICATIONS.md': short('Notifications', `Notify on sync failure, missing mappings, inventory contract blockers — no false production-ready claims.`),

  'PHASE_10_METRICS.md': short('Metrics', `Sync runs, records received, suggestions, mappings activated, discrepancies.`),

  'PHASE_10_ALERTS.md': short('Alerts', `CRITICAL: cross-tenant mapping, local stock modified by sync (must never occur), duplicate inventory submit.`),

  'PHASE_10_TYPED_ERRORS.md': short('Typed Errors', `Uses EisErrors + stable codes (PRODUCT_SYNC_CONTRACT_UNVERIFIED, UOM_*, PRODUCT_SERVICE_TYPE_MISMATCH, INITIAL_INVENTORY_CONTRACT_UNVERIFIED).`),

  'PHASE_10_SECURITY.md': short('Security', `Server-only client; browser cannot force ACTIVE/method/environment; foreign external IDs rejected.`),

  'PHASE_10_RESPONSIVE_UI.md': short('Responsive UI', `Tables scroll; overview cards stack; actions wrap.`),

  'PHASE_10_ACCESSIBILITY.md': short('Accessibility', `Status text, alerts, aria-current tabs, sr-only captions.`),

  'LEGACY_PRODUCT_SERVICE_MIGRATION_PLAN.md': short('Legacy Migration Plan', `Dry-run first. Create SUGGESTED/MANUAL_REVIEW only. No stock/Sale/Journal mutation.`),

  'LEGACY_PRODUCT_SERVICE_MIGRATION_REPORT.md': short('Legacy Migration Report', `Not executed against production data in this phase.`),

  'MOCK_MRA_CATALOGUE_INVENTORY_SERVER.md': short('Mock Catalogue Server', `Scenarios: SUCCESS, UNCHANGED, EMPTY_VALID, TIN/SITE mismatch, TERMINAL_BLOCKED, HTTP 429/500, DUPLICATE_BARCODE, INVALID_DECIMAL, inventory ACCEPTED/REJECTED/UNKNOWN/CONTRACT_UNVERIFIED.`),

  'PHASE_10_SYNTHETIC_FIXTURES.md': short('Synthetic Fixtures', `Mock products/services MOCK-P-* / MOCK-S-*. No real MRA credentials.`),

  'PHASE_10_TEST_PLAN.md': short('Test Plan', `\`test/mraEis.phase10.catalogue.test.js\`.`),

  'PHASE_10_TEST_RESULTS.md': short('Test Results', `See vitest run output for phase10 catalogue tests.`),

  'PHASE_10_SECURITY_TEST_RESULTS.md': short('Security Test Results', `| Case | Result |
|---|---|
| Production sync blocked | PASS |
| GET method rejected on mock | PASS |
| Inventory submit blocked | PASS |
| Snapshot has no credentials | PASS |
| Cross-type blocked | PASS |`),

  'PHASE_10_SANDBOX_VERIFICATION_REPORT.md': short('Sandbox Verification Report', `Live MRA sandbox catalogue sync **NOT RUN**. MOCK path verified via unit tests.`),

  'PHASE_10_DEPLOYMENT_PLAN.md': short('Deployment Plan', `1. Deploy app with Phase 10 modules
2. Keep MRA_EIS_ACTIVATION_MODE=MOCK until Q-003 cleared
3. Do not set MRA_EIS_INITIAL_INVENTORY_SUBMIT=true
4. Verify catalogue UI + readiness APIs`),

  'PHASE_10_ROLLBACK_PLAN.md': short('Rollback Plan', `Disable catalogue routes/UI. External catalogue rows retained. No local master data was mutated by sync.`),

  'PHASE_10_INCIDENT_RUNBOOKS.md': short('Incident Runbooks', `| Incident | Action |
|---|---|
| Suspected stock change from sync | Impossible by design — audit metadata stockMutated=false; investigate other writers |
| Q-003 production attempt | Blocked; open clarification |
| Unknown inventory outcome | Do not blind-retry; Manual Review |`),

  'PHASE_10_RISK_REGISTER.md': short('Risk Register', `| Risk | Mitigation |
|---|---|
| Wrong HTTP method | Production blocked |
| Partial inactivation | UNKNOWN policy forbids |
| Auto-activate barcode | Forbidden |
| Cross-type misuse | Blocked |
| Inventory upload guess | Blocked provider |`),

  'PHASE_11_HANDOVER.md': short('Phase 11 Handover', `## Phase 11 will implement
- Sale eligibility for POS and Invoices
- Finalization-event bridge + Outbox
- Credit sale / draft exclusions
- Resolution of Site/Product/Service/Tax/Levy/Payment at eligibility time

## Available from Phase 10
- Business type classification
- MOCK catalogue sync + external Product/Service storage
- Product/Service suggestions + lifecycle
- Product/Service resolution + snapshot contract
- Completeness with inventory/VW blockers
- Initial Inventory requirement + read-only reconcile
- Blocked inventory submit provider

## Carry-forward blockers
- Q-003 Product sync method
- Initial Inventory contract
- Virtual Warehouse
- Split payment
- Bundle policy
- Phase 7/8 production crypto/identity gates`),

  'PHASE_10_READINESS_DECISION.md': short('Phase 10 Readiness Decision', `## Decision: READY_FOR_PHASE_11_WITH_BLOCKERS

| Area | Result |
|---|---|
| Business classification | Implemented |
| Product sync contract | REQUIRES_MRA_CLARIFICATION (prod blocked) |
| Service sync contract | Same |
| Catalogue sync (MOCK) | Implemented |
| Mapping + resolution | Implemented |
| UOM | Implemented |
| Tax consistency | Implemented |
| Variants/Bundles | Clarification / explicit SKU |
| Completeness | Implemented |
| Initial Inventory | Requirement + reconcile; submit blocked |
| Security / multi-tenant | Server-scoped |
| Tests | Unit suite |

### Recommended next action
Proceed to Phase 11 Sales eligibility using resolution services. Do not enable production fiscalization until Product sync contract, inventory (if required), VW, and Product/Service mappings are complete for the Business.`),

  'FINAL_PHASE_10_IMPLEMENTATION_REPORT.md': `# Final Phase 10 Implementation Report

## Executive summary
Phase 10 delivers external Product/Service catalogue synchronization (MOCK), versioned storage, advisory mapping suggestions, verification/activation lifecycle, deterministic resolution services, completeness, and fail-closed Initial Inventory controls. Production Product sync and Inventory upload remain blocked pending MRA clarification.

## Confirmations
- External catalogue separate from local master data
- Sync does not update local stock, prices, or taxes
- Suggestions never auto-activate
- Product/Service types explicit; cross-type blocked
- UOM conversions versioned; no stock mutation
- Resolution returns mapping + catalogue versions
- Inventory reconciliation/snapshot create no Journal/Stock Movement
- Inventory submit blocked when unverified
- No Sale submitted; no fiscal number; no MRA-validated receipt

## Decision
\`READY_FOR_PHASE_11_WITH_BLOCKERS\`
`,
};

for (const [name, body] of Object.entries(files)) {
  w(name, body);
}
console.log(`Wrote ${Object.keys(files).length} Phase 10 docs to ${root}`);
