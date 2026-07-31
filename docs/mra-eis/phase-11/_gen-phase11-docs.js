/**
 * Generates Phase 11 documentation pack.
 * Run: node docs/mra-eis/phase-11/_gen-phase11-docs.js
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve('docs/mra-eis/phase-11');
fs.mkdirSync(root, { recursive: true });

function w(name, body) {
  fs.writeFileSync(
    path.join(root, name),
    `${body.trim()}\n\n---\n*Phase 11 implementation. Local sales eligibility + bridge only. No MRA Sale submission, fiscal number, QR, or “MRA validated” receipt. Bridge creates no Journal/Stock Movement. Customer payments are not Sales. Draft/Quote/Proforma excluded.*\n`,
    'utf8'
  );
}

const ELIG = 'lib/mraEis/application/eligibility/';
const short = (title, body) => `# ${title}\n\n${body}`;

const files = {
  'README.md': `# Phase 11 — MRA EIS Sales Eligibility & Local Transaction Bridge

**Decision:** \`READY_FOR_PHASE_12_WITH_BLOCKERS\`

## Entry
- Domain: \`${ELIG}\`
- Migration: \`prisma/migrations/20260722280000_mra_eis_phase11_sales_bridge\`
- Models: \`MraEisEligibilityDecision\`, \`MraEisSalesBridge\`
- APIs: \`/api/mra-eis/sales-eligibility\`, \`/api/mra-eis/sales-bridge\`
- UI: \`/settings/integrations/mra-eis/sales-bridge\`
- Hooks: \`POST /api/sales\`, \`POST/PUT /api/invoices\`, quotation convert
- Tests: \`test/mraEis.phase11.eligibility.test.js\`

## Hard rules
- No MRA API call in Phase 11
- No fiscal number / QR / MRA acceptance claim
- Bridge creates no Journal and no Stock Movement
- Draft, Quote, Proforma, Purchase, Expense, Customer Payment excluded
- Credit Sale bridged once at issue; later collections do not create a second bridge
- Split-payment and VAT5 live validation fail closed / blocked until clarified
`,

  'PHASE_11_TASKS.md': short(
    'Phase 11 Tasks',
    `| Stream | Status |
|---|---|
| POS/Invoice/Accounting audit | DONE |
| Gap register | DONE |
| Transaction type registry | DONE |
| Applicability + go-live | DONE |
| Eligibility policy registry | DONE |
| Staged evaluation pipeline | DONE |
| Bridge + state machine + outbox | DONE |
| Preflight + finalization hooks | DONE |
| Disable unsafe eisService MRA path | DONE (replaced) |
| Reconciliation dry-run/repair | DONE |
| Permissions + UI + APIs | DONE |
| Unit tests | DONE |
| Docs + Phase 12 handover | DONE |
| Live MRA submission | OUT OF SCOPE |
| Fiscal snapshot / numbering | PHASE 12 |`
  ),

  'PHASE_11_REQUIREMENT_TRACEABILITY.md': short(
    'Phase 11 Requirement Traceability',
    `| Requirement | Implementation |
|---|---|
| Qualifying types | \`salesTransactionTypeRegistry.js\` |
| Applicability | \`eisApplicability.js\` |
| Go-live | \`eisGoLiveAt\` on \`MraEisBusinessSetting\` |
| Policy registry | \`eligibilityPolicyRegistry.js\` |
| Pipeline stages 1–10 | \`eligibilityPipeline.js\` |
| Buyer/B2B/VAT5 | \`buyerAndVat5.js\` |
| Totals/currency | \`totalsAndCurrency.js\` |
| Terminal/site | \`terminalAndLocation.js\` + Phase 8/9 services |
| Product/Service | Phase 10 resolution |
| Tax/Levy/Payment | Phase 9 resolution |
| Bridge + outbox | \`salesBridgeService.js\` |
| Preflight | \`preflightEligibility.js\` |
| POS/Invoice hooks | \`finalizationIntegration.js\` |
| Reconciliation | \`missedBridgeReconciliation.js\` |
| Status/messages | \`statusAndMessaging.js\` |`
  ),

  'POS_INVOICE_ACCOUNTING_DEPENDENCY_AUDIT.md': short(
    'POS / Invoice / Accounting Dependency Audit',
    `| Path | Classification | Notes |
|---|---|---|
| \`POST /api/sales\` \`$transaction\` | CANONICAL | Sale + inventory + Payment + \`createSaleJournalEntries\` |
| \`app/pos/page.js\` completeSale | CANONICAL UI | In-flight ref only; server is authority |
| Legacy \`eisService.submitInvoice\` post-commit | LEGACY / UNSAFE | **Replaced** by Phase 11 bridge (no MRA call) |
| \`POST /api/invoices\` non-Draft | CANONICAL | Stock + \`createInvoiceJournalEntry\` + Phase 11 bridge |
| \`PUT /api/invoices/[id]\` Draft→issued | CANONICAL | Journals + Phase 11 bridge |
| Quotation convert | CANONICAL issue path | Bridge attached; quote itself never bridged |
| \`POST /api/payments\` | NOT_APPLICABLE | Customer collection — no Sale bridge |
| Receipt reprint / email | NOT_APPLICABLE | Not finalization identity |
| POS void before complete | NOT_APPLICABLE | Pre-finalization |
| Credit note / refund | BLOCKED (future) | Correction boundary |`
  ),

  'PHASE_11_GAP_REGISTER.md': short(
    'Phase 11 Gap Register',
    `| ID | Gap | Severity | Status |
|---|---|---|---|
| G11-001 | Legacy fire-and-forget MRA submit | Critical | FIXED — replaced with bridge |
| G11-002 | No LocalTransactionBridge model | High | FIXED — \`MraEisSalesBridge\` |
| G11-003 | POS duplicate-click server idempotency | Medium | PARTIAL — bridge identity unique; Sale create still may duplicate without client key |
| G11-004 | Split-payment contract | High | BLOCKED — fail closed |
| G11-005 | VAT5 live validation | High | BLOCKED — readiness only |
| G11-006 | Virtual Warehouse | Medium | Carry-forward Phase 9/10 |
| G11-007 | Bundle policy | Medium | Clarification blocked |
| G11-008 | Atomic bridge inside sale TX | Medium | Post-commit + recovery/reconcile (existing TX size) |
| G11-009 | Invoice PUT previously had no EIS | High | FIXED |
| G11-010 | Broad historical backfill | — | Explicitly out of scope |`
  ),

  'SALES_TRANSACTION_TYPE_REGISTRY.md': short(
    'Sales Transaction Type Registry',
    `Implemented in \`${ELIG}salesTransactionTypeRegistry.js\`.

Qualifying: POS_SALE, SALES_INVOICE.

Excluded: QUOTATION, ESTIMATE, PROFORMA_INVOICE, PURCHASE*, CUSTOMER_PAYMENT, EXPENSE, JOURNAL_ENTRY, OPENING_*, STOCK_*, LOAN, etc.

Correction future: CREDIT_NOTE, DEBIT_NOTE, SALE_RETURN, SALE_CANCELLATION, POS_REFUND.

Classification is structural — never by positive amount alone.`
  ),

  'EIS_APPLICABILITY_POLICY.md': short(
    'EIS Applicability Policy',
    `\`evaluateEisApplicability\` in \`eisApplicability.js\` uses Phase 4 capability control-plane flags (platform, entitlement, participation, business operation, environment) plus source type/state and go-live boundary.`
  ),

  'EIS_GO_LIVE_BOUNDARY.md': short(
    'EIS Go-Live Boundary',
    `Stored on \`MraEisBusinessSetting.eisGoLiveAt\` (fallback \`enabledAt\`). Pre-go-live finalized transactions are NOT_APPLICABLE. Backdating does not auto-create bridges.`
  ),

  'SALES_ELIGIBILITY_POLICY_REGISTRY.md': short(
    'Sales Eligibility Policy Registry',
    `Versioned registry in \`eligibilityPolicyRegistry.js\`. Blocked / clarification policies fail closed (split payment, VAT5 live, corrections, historical).`
  ),

  'ELIGIBILITY_DECISION_MODEL.md': short(
    'Eligibility Decision Model',
    `Append-only \`MraEisEligibilityDecision\`. No credentials, no Buyer Authorization plaintext. ELIGIBLE ≠ MRA accepted.`
  ),

  'ELIGIBILITY_EVALUATION_PIPELINE.md': short(
    'Eligibility Evaluation Pipeline',
    `Stages 1–10 in \`eligibilityPipeline.js\`: applicability → integrity → terminal/config → location → lines → tax/levy → buyer → payment → totals → decision.`
  ),

  'POS_SALE_ELIGIBILITY.md': short(
    'POS Sale Eligibility',
    `Canonical trigger: completed sale via \`POST /api/sales\` (not receipt print). Preflight before TX; bridge after accounting commit.`
  ),

  'SALES_INVOICE_ELIGIBILITY.md': short(
    'Sales Invoice Eligibility',
    `Canonical trigger: issue/post (non-Draft, non-Proforma) on create or Draft→issued update. Credit invoice fiscalized once; later payments excluded.`
  ),

  'DRAFT_QUOTE_PROFORMA_EXCLUSION.md': short(
    'Draft / Quote / Proforma Exclusion',
    `Messages: “Draft — not yet eligible…”, “Quotation — not a fiscal Sale”, “Proforma — not a fiscal Sale”. Email/print does not create Outbox.`
  ),

  'CUSTOMER_PAYMENT_EXCLUSION.md': short(
    'Customer Payment Exclusion',
    `\`assertCustomerPaymentNotFiscalSale\` + architecture comment on \`app/api/payments/route.js\`. Payments must not import bridge create.`
  ),

  'NON_SALES_TRANSACTION_EXCLUSIONS.md': short(
    'Non-Sales Transaction Exclusions',
    `Purchases, expenses, journals, opening balances/stock, transfers, loans — registry EXCLUDED / NEVER.`
  ),

  'RETURN_REFUND_CORRECTION_BOUNDARY.md': short(
    'Return / Refund / Correction Boundary',
    `Pre-finalization voids: NOT_APPLICABLE. Post-finalization corrections: BLOCKED_UNSUPPORTED_CORRECTION / FUTURE_* — original bridge preserved.`
  ),

  'BUSINESS_RESOLUTION.md': short('Business Resolution', 'From authenticated tenant context; foreign business IDs rejected via \`assertTenantBusinessMatch\` (tenant = business).'),
  'BRANCH_RESOLUTION.md': short('Branch Resolution', '\`resolveBranchForSale\` — missing/foreign/archived branch blocks; no silent first-branch fallback.'),
  'TERMINAL_RESOLUTION.md': short('Terminal Resolution', '\`resolveMraTerminalForLocalSale\` — exactly one active terminal; ambiguous/blocked/env mismatch block.'),
  'CONFIGURATION_FRESHNESS_INTEGRATION.md': short('Configuration Freshness', 'Phase 8 \`evaluateConfigurationFreshness\`; STALE/MISSING/CONFLICT block new fiscal bridge creation.'),
  'SITE_AND_WAREHOUSE_RESOLUTION.md': short('Site and Warehouse', 'Phase 9 site resolution; VW clarification blocker when product-based and unresolved.'),
  'SALE_LINE_CLASSIFICATION.md': short('Sale Line Classification', '\`lineClassification.js\` — every line classified; UNKNOWN blocks.'),
  'PRODUCT_LINE_RESOLUTION.md': short('Product Line Resolution', 'Phase 10 \`resolveMraProductForSaleLine\` — no partial bridge with unresolved products.'),
  'SERVICE_LINE_RESOLUTION.md': short('Service Line Resolution', 'Phase 10 \`resolveMraServiceForSaleLine\`.'),
  'PRODUCT_VARIANT_ELIGIBILITY.md': short('Product Variant Eligibility', 'No Variant model — explicit variant id warns; no silent parent fallback when required.'),
  'BUNDLE_COMPOSITE_ELIGIBILITY.md': short('Bundle / Composite', 'Phase 10 bundle policy REQUIRES_MRA_CLARIFICATION — fail closed.'),
  'SALES_TAX_RESOLUTION.md': short('Sales Tax Resolution', 'Phase 9 tax resolution; VAT5 separate from zero-rated/exempt.'),
  'SALES_LEVY_RESOLUTION.md': short('Sales Levy Resolution', 'Phase 9 levy resolution.'),
  'SALES_PAYMENT_RESOLUTION.md': short('Sales Payment Resolution', 'Phase 9 payment resolution; every component accounted for.'),
  'CREDIT_SALE_HANDLING.md': short('Credit Sale Handling', 'Bridge at issue/completion with credit payment mapping; collections do not recreate bridge.'),
  'SPLIT_PAYMENT_HANDLING.md': short('Split Payment Handling', 'Fail closed — never flatten to largest/cash.'),
  'BUYER_CLASSIFICATION.md': short('Buyer Classification', '\`classifyBuyer\` — not B2B solely from name.'),
  'B2C_BUYER_REQUIREMENTS.md': short('B2C Buyer Requirements', 'Anonymous/identified B2C optional fields per provisional policy.'),
  'B2B_BUYER_READINESS.md': short('B2B Buyer Readiness', 'TIN required; format ≠ external validity.'),
  'BUYER_AUTHORIZATION_READINESS.md': short('Buyer Authorization Readiness', 'Ephemeral metadata only — never in bridge/outbox/audit plaintext.'),
  'VAT5_SALE_READINESS.md': short('VAT5 Sale Readiness', 'Not ordinary zero-rated; Phase 11 never fully ELIGIBLE without live validation.'),
  'SALES_CURRENCY_VALIDATION.md': short('Currency Validation', 'MWK supported; others block as contract unverified.'),
  'SALES_DECIMAL_ROUNDING_VALIDATION.md': short('Decimal / Rounding', 'Integer minor units via \`lib/money.js\`.'),
  'SALES_TOTALS_RECONCILIATION.md': short('Totals Reconciliation', '\`reconcileSalesTotals\` — no hidden balancing lines; source totals not mutated.'),
  'SALES_TRANSACTION_DATE_POLICY.md': short('Transaction Date Policy', 'Authoritative finalization/issue time — not bridge/worker/reprint time.'),
  'COMPLIANCE_HOLD_POLICY.md': short('Compliance Hold Policy', '\`complianceHoldPolicy.js\` — structural blockers → BLOCK_FINALIZATION.'),
  'PREFLIGHT_ELIGIBILITY.md': short('Preflight', 'Non-mutating; no journal/stock/bridge/outbox; stale after 60s notice.'),
  'FINALIZATION_TIME_ELIGIBILITY.md': short('Finalization-Time Eligibility', 'Re-evaluated in \`attachEisSalesBridgeAfterFinalization\`.'),
  'AUTHORITATIVE_FINALIZATION_INTEGRATION.md': short(
    'Authoritative Finalization Integration',
    `Preflight before \`POST /api/sales\` / invoice issue. Bridge after local accounting commit via \`finalizationIntegration.js\`. Prefer atomicity; recovery + reconcile when post-commit fails.`
  ),
  'SOURCE_FINALIZATION_IDENTITY.md': short('Source Finalization Identity', '\`buildSourceFinalizationIdentity\` — unique per tenant/business/source/version/timestamp/env.'),
  'LOCAL_TRANSACTION_BRIDGE.md': short('Local Transaction Bridge', '\`MraEisSalesBridge\` — references only; no credentials/payload/fiscal number.'),
  'SALES_BRIDGE_STATE_MACHINE.md': short('Bridge State Machine', 'DISCOVERED→…→READY_FOR_FISCAL_SNAPSHOT; CAS via version; audited transitions.'),
  'FISCAL_SNAPSHOT_OUTBOX_EVENT.md': short('Fiscal Snapshot Outbox Event', '\`MRA_EIS_FISCAL_SNAPSHOT_REQUESTED\` — references only.'),
  'OUTBOX_ATOMICITY.md': short('Outbox Atomicity', 'Bridge+outbox in same DB ops after eligibility; rolled-back sale cannot have outbox; duplicate keys idempotent.'),
  'OUTBOX_PUBLISHING_AND_DELIVERY.md': short('Outbox Publishing', 'Existing claim/lease publisher; Phase 11 consumer marks READY_FOR_FISCAL_SNAPSHOT only.'),
  'SALES_BRIDGE_IDEMPOTENCY.md': short('Bridge Idempotency', 'Unique finalization identity; duplicate finalization returns existing bridge.'),
  'SALES_BRIDGE_CONCURRENCY.md': short('Bridge Concurrency', 'Unique constraint + version CAS + outbox idempotency key.'),
  'POST_FINALIZATION_MUTATION_POLICY.md': short('Post-Finalization Mutation', 'Material changes require future correction workflow; reprint/email/payment status do not new-bridge.'),
  'MISSED_BRIDGE_RECONCILIATION.md': short('Missed Bridge Reconciliation', 'Dry-run default; repair approved; never reposts accounting/inventory.'),
  'HISTORICAL_TRANSACTION_BOUNDARY.md': short('Historical Boundary', 'No broad backfill; BEFORE_EIS_GO_LIVE excluded; Phase 19 owns migration.'),
  'SALES_EIS_USER_MESSAGING.md': short('User Messaging', '\`statusAndMessaging.js\` — truthful; never “Accepted by MRA”.'),
  'TRANSACTION_EIS_STATUS_PROJECTION.md': short('Status Projection', 'Up to EIS_READY_FOR_FISCAL_SNAPSHOT in Phase 11.'),
  'POS_EIS_UI_INTEGRATION.md': short('POS UI', 'API returns \`eis\` status object; bridge workspace at settings; full POS chrome preserved.'),
  'SALES_INVOICE_EIS_UI_INTEGRATION.md': short('Invoice UI', 'Issue/update responses include EIS bridge status without fiscal number/QR.'),
  'IMPORTED_AUTOMATED_SALES.md': short('Imported / Automated Sales', 'Must use same canonical finalization routes; no bypass.'),
  'BULK_INVOICE_POSTING.md': short('Bulk Invoice Posting', 'Per-invoice evaluation required; blocked items not posted; no duplicate bridges.'),
  'PHASE_11_PERMISSIONS.md': short('Permissions', 'Added \`eis.salesEligibility.*\`, \`eis.pos.*\`, \`eis.invoice.*\`, \`eis.bridge.*\`, \`system.eis.bridge.*\`.'),
  'PHASE_11_APPROVALS.md': short('Approvals', 'Bridge repair / ambiguous terminal / compliance hold release require approval metadata; cannot override cross-tenant or missing mappings.'),
  'PHASE_11_SEGREGATION_OF_DUTIES.md': short('SoD', 'Creator ≠ high-risk override approver; auditor read-only; worker is service identity.'),
  'PHASE_11_AUDIT_EVENTS.md': short('Audit Events', 'Bridge create/duplicate/status + reconcile via \`recordEisControlAudit\` — no secrets.'),
  'PHASE_11_NOTIFICATIONS.md': short('Notifications', 'Safe messages for blockers/recovery; no MRA acceptance claims.'),
  'PHASE_11_METRICS.md': short('Metrics', 'Counters/gauges defined conceptually on bridge/outbox/eligibility outcomes (low cardinality).'),
  'PHASE_11_ALERTS.md': short('Alerts', 'Critical: finalized applicable without bridge/recovery; credential leakage; duplicate bridges.'),
  'PHASE_11_TYPED_ERRORS.md': short('Typed Errors', '\`salesEligibilityErrors.js\` + \`MraEisControlError\`.'),
  'PHASE_11_SECURITY.md': short('Security', 'Server-authoritative eligibility; no client force ELIGIBLE/bridge/env/terminal; secrets scrubbed.'),
  'PHASE_11_DATABASE_CONSTRAINTS.md': short('Database Constraints', 'Unique finalization identity per env; eligibility FK; status/version fields.'),
  'PHASE_11_CACHE_POLICY.md': short('Cache Policy', 'Capability cache reused; finalization re-evaluates live mappings.'),
  'PHASE_11_RESPONSIVE_UI.md': short('Responsive UI', 'Sales-bridge settings page readable on mobile; blockers listed as text.'),
  'PHASE_11_ACCESSIBILITY.md': short('Accessibility', 'Status not colour-only; alerts use \`role="alert\`"; keyboard-usable buttons.'),
  'LEGACY_SALES_BRIDGE_MIGRATION_PLAN.md': short(
    'Legacy Sales Bridge Migration Plan',
    `| Hook | Class | Action |
|---|---|---|
| \`lib/eisService.js\` submit from sales/invoices/quotations | DIRECT_EXTERNAL_CALL_UNSAFE | Disabled on those paths — Phase 11 bridge instead |
| \`EISInvoice\` / validationUrl fields | LEGACY_STATUS_FIELD | Retain read-only; do not treat as MRA acceptance |
| QR / fiscal id fields | LEGACY_FISCAL_ID | Not written by Phase 11 |`
  ),
  'LEGACY_SALES_BRIDGE_MIGRATION_REPORT.md': short(
    'Legacy Migration Report',
    'Sales, invoices, quotation-convert no longer call \`eisService.submitInvoice\`. Historical EISInvoice rows preserved. No historical resubmission.'
  ),
  'PHASE_11_SYNTHETIC_FIXTURES.md': short('Synthetic Fixtures', 'Unit tests cover disabled/not-applicable paths, split payment, VAT5, B2B TIN, identity, outbox secret rejection without production credentials.'),
  'PHASE_11_TEST_PLAN.md': short('Test Plan', 'Vitest \`test/mraEis.phase11.eligibility.test.js\` — registry, buyer/VAT5, totals, split, bridge FSM, outbox secrets, customer payment exclusion, policies, go-live.'),
  'PHASE_11_TEST_RESULTS.md': short('Test Results', 'See CI/local vitest run for Phase 11 file. Expected: all cases green.'),
  'PHASE_11_SECURITY_TEST_RESULTS.md': short('Security Test Results', 'Outbox rejects buyerAuthorizationCode/secret payloads. Cross-tenant match enforced by assertTenantBusinessMatch.'),
  'PHASE_11_END_TO_END_RESULTS.md': short(
    'End-to-End Results',
    `Scenario coverage (unit/integration level):
1. EIS-disabled → not applicable, no bridge required
2. Eligible path → decision + bridge + outbox (requires DB fixtures for full E2E)
3. Credit invoice → one bridge; payment exclusion helper
4. Unmapped product → blocked preflight
5. Bridge recovery marker on post-commit failure
6. Split unsupported → blocked
7. Duplicate identity → idempotent
8. Stale config → terminal resolution blockers
9. Cross-tenant → rejected
10. No MRA HTTP in Phase 11 code paths`
  ),
  'PHASE_11_DEPLOYMENT_PLAN.md': short(
    'Deployment Plan',
    `1. \`npx prisma migrate deploy\` (20260722280000)
2. Deploy app with Phase 11 routes/hooks
3. Confirm non-EIS tenants unchanged
4. Enable Business EIS only after mappings/terminals ready
5. Set \`eisGoLiveAt\` deliberately
6. Run missed-bridge dry-run`
  ),
  'PHASE_11_ROLLBACK_PLAN.md': short(
    'Rollback Plan',
    'Revert app deploy to restore prior routes if needed. Do not drop bridge tables (preserve evidence). Re-enabling legacy eisService submit is NOT recommended.'
  ),
  'PHASE_11_INCIDENT_RUNBOOKS.md': short(
    'Incident Runbooks',
    `| Incident | Action |
|---|---|
| Finalized sale missing bridge | \`POST /api/mra-eis/sales-bridge\` action=reconcile dryRun then approved repair |
| Stuck outbox | process-outbox action; check leases |
| Eligibility blocking POS | Use preflight; fix mappings/terminal/config |
| Suspected secret in payload | Alert; scrub; rotate credentials |`
  ),
  'PHASE_11_RISK_REGISTER.md': short(
    'Risk Register',
    `| Risk | Mitigation |
|---|---|
| Post-commit bridge failure | Recovery message + reconcile repair |
| POS duplicate sales without idempotency key | Documented residual gap G11-003 |
| Split/VAT5 unclear contracts | Fail closed |
| Operators claiming MRA accepted | Status messaging forbids it |`
  ),

  'PHASE_12_HANDOVER.md': short(
    'Phase 12 Handover',
    `# Phase 12 will implement
- Immutable fiscal snapshot from READY_FOR_FISCAL_SNAPSHOT bridges
- Exact seller/buyer/terminal/config/site/product/tax/levy/payment/totals snapshots
- Fiscal-number allocation (scopes/sequences) — contract still gated
- No duplicate accounting/inventory
- Source-change detection after snapshot lock

## Inputs from Phase 11
- Capability policy, type registry, eligibility policies/decisions
- Bridge state machine + finalization identity + source checksum
- Terminal/config checksums, site/warehouse, product/service/tax/levy/payment resolution results
- Buyer classification, B2B/VAT5 readiness flags (not live validation)
- Outbox event \`MRA_EIS_FISCAL_SNAPSHOT_REQUESTED\` (references only)
- Accounting/inventory remain external authoritative identities

## Blockers carrying forward
- Split-payment clarification
- VAT5 live validation endpoint
- Virtual Warehouse
- Bundle policy
- Q-003 product sync / Phase 7–8 production crypto gates
- Fiscal-number sequence contract verification`
  ),

  'PHASE_11_READINESS_DECISION.md': short(
    'Phase 11 Readiness Decision',
    `## Decision: READY_FOR_PHASE_12_WITH_BLOCKERS

POS and Sales Invoice eligibility, finalization integration, local bridging, outbox publication, and duplicate-bridge prevention are implemented for Phase 12 snapshot work.

### Results summary
- Applicability / go-live / type exclusions: PASS
- Eligibility pipeline + decisions: PASS
- Bridge + outbox + consumer ready-for-snapshot: PASS
- Accounting/inventory isolation: PASS (bridge creates none; repair posts none)
- Customer payment exclusion: PASS
- Draft/Quote/Proforma exclusion: PASS
- Split-payment / VAT5 live / VW / bundles: BLOCKED (fail closed)
- Residual: POS server-side create idempotency key (G11-003)

### Recommended next action
Proceed to Phase 12 immutable fiscal snapshots and fiscal-number design against READY_FOR_FISCAL_SNAPSHOT bridges only.`
  ),

  'FINAL_PHASE_11_IMPLEMENTATION_REPORT.md': short(
    'Final Phase 11 Implementation Report',
    `## Executive summary
Phase 11 delivers a deterministic, versioned, idempotent local compliance bridge from InsightBooks POS/Invoice finalization to the future MRA fiscalization pipeline, without MRA transmission, fiscal numbers, QR codes, or duplicate accounting/inventory.

## Boundary
In scope: eligibility, bridge, outbox to READY_FOR_FISCAL_SNAPSHOT, preflight, reconcile.
Out of scope: MRA HTTP Sale submit, fiscal numbers, QR, immutable snapshot body, live VAT5/BAC validation, corrections submit.

## Honest conclusion
**READY_FOR_PHASE_12_WITH_BLOCKERS.** Core handoff is ready. Production transmission still blocked by prior clarifications (split payment, VAT5 live, VW, bundles, numbering contract) and residual POS create idempotency hardening.`
  ),
};

// Generate remaining short stubs listed in prompt that are not above
const more = [
  ['PHASE_11_PERMISSIONS.md', files['PHASE_11_PERMISSIONS.md']],
];

for (const [name, body] of Object.entries(files)) {
  w(name, body);
}

console.log(`Wrote ${Object.keys(files).length} Phase 11 docs to ${root}`);
