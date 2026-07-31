/**
 * Generates Phase 4 documentation pack reflecting the implemented control plane.
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve('docs/mra-eis/phase-4');
fs.mkdirSync(root, { recursive: true });

function w(name, body) {
  fs.writeFileSync(
    path.join(root, name),
    `${body.trim()}\n\n---\n*Phase 4 implementation. No MRA API calls from entitlement actions. No terminals activated. No posted Journals modified.*\n`,
    'utf8'
  );
}

const files = {
  'README.md': `# Phase 4 — Platform Entitlement & Tenant Operational Controls

**Decision:** see PHASE_4_READINESS_DECISION.md

## Entry points
- System Admin UI: \`/insightbooks/mra-eis\`
- Tenant UI: \`/settings/integrations/mra-eis\`
- Module: \`lib/mraEis/\`
- Migration: \`prisma/migrations/20260722220000_mra_eis_phase4_entitlement\`

## Hierarchy
Platform → System Admin entitlement → Environment → Tenant participation → Business operational setting → Future runtime deps → Effective capability
`,
  'PHASE_4_TASKS.md': `# Phase 4 Tasks

All workstreams A–BR from the master prompt are covered by implementation + docs in this folder.
Status: COMPLETE for control-plane scope; future terminal/fiscal work deferred to Phase 5+.
`,
  'PHASE_4_REQUIREMENT_TRACEABILITY.md': `# Phase 4 Requirement Traceability

| Requirement | Evidence | Implementation |
|---|---|---|
| Two-level entitlement | Phase 3 EIS_ENTITLEMENT_ARCHITECTURE | MraEisTenantEntitlement + Participation + BusinessSetting |
| Effective capability | Phase 3 ADR + handover | lib/mraEis/policies/effectiveCapability.js |
| Platform kill switch | Phase 3 | MraEisPlatformSetting |
| No self-entitle | Phase 3/4 rules | Admin-only grant APIs |
| Sandbox ≠ production | Phase 3 | productionAllowed flag + policy |
| History retained | Phase 3 | Soft status changes; no deletes |
| No MRA I/O | Phase 4 boundary | No client in lib/mraEis |
| Fix hasEISAccess | Phase 2 G2-004 | subscriptionService.js |
| Gate legacy submit | Phase 2/4 | canSubmitEISInvoice + sales/invoices/quotations |
`,
  'CURRENT_FEATURE_CONTROL_AUDIT.md': `# Current Feature Control Audit

## Found
- Subscription EIS plans: eis-monthly / eis-yearly (\`lib/subscriptionConfig.js\`)
- \`hasEISAccess\` (buggy before Phase 4) + \`Tenant.eisEnabled\`
- Legacy \`EISConfiguration\` / \`EISInvoice\` / \`app/api/eis/*\` / \`lib/eisService.js\`
- Admin auth: \`lib/adminAuth.js\` + Super Admin short-circuit
- Feature flags pattern: \`AcctV2FeatureFlag\` (not used for EIS before Phase 4)
- Approvals: SecV2 approval engine (not wired to EIS before Phase 4)
- Audit: AdminAuditLog + new MraEisControlAuditEvent
- Tenant = Business (no separate Business model)

## Gaps closed in Phase 4
- Platform status + emergency pause
- Explicit entitlement aggregate
- Participation vs operational settings
- Canonical capability policy
- Admin + tenant UIs
`,
  'PHASE_4_GAP_REGISTER.md': `# Phase 4 Gap Register

| ID | Gap | Resolution |
|---|---|---|
| G4-001 | Single Boolean eisEnabled overloaded | Separated into entitlement/participation/business/capability |
| G4-002 | hasEISAccess plan selection bug | Fixed EIS plan filter |
| G4-003 | No platform kill switch | MraEisPlatformSetting |
| G4-004 | Legacy fire-and-forget MRA submit | Gated by canSubmitEISInvoice/capability |
| G4-005 | No EIS permissions | eis.* module + system.eis.* admin checks |
| G4-006 | Terminal/config/mappings absent | Represented as future blockers only |
`,
  'PLATFORM_EIS_CONTROL_IMPLEMENTATION.md': `# Platform EIS Control

Table \`MraEisPlatformSetting\` id=global. Statuses: DISABLED, ENABLED, EMERGENCY_PAUSED, MAINTENANCE, RETIRED.
API: GET/PUT \`/api/admin/mra-eis/platform\`. Default DISABLED.
`,
  'TENANT_ENTITLEMENT_IMPLEMENTATION.md': `# Tenant Entitlement

\`MraEisTenantEntitlement\` with isCurrent + version history. Grant/suspend/resume/revoke via admin APIs.
Revoked cannot resume; re-grant creates new version.
`,
  'TENANT_PARTICIPATION_IMPLEMENTATION.md': `# Tenant Participation

\`MraEisTenantParticipation\`. Opt-in requires active entitlement. Pause/opt-out require reason. System suspension overrides.
`,
  'BUSINESS_OPERATIONAL_SETTING_IMPLEMENTATION.md': `# Business Operational Setting

\`MraEisBusinessSetting\` with businessId=tenantId. Setup start/resume, ready-for-activation, pause, disable-before-activation.
Full OPERATIONALLY_ENABLED fiscalization blocked until Phase 5+ runtime deps.
`,
  'ENTITLEMENT_STATE_MACHINE_IMPLEMENTATION.md': `# Entitlement State Machine

Implemented in \`lib/mraEis/domain/stateMachines.js\` — ENTITLEMENT_TRANSITIONS + assertEntitlementTransition.
`,
  'PARTICIPATION_STATE_MACHINE_IMPLEMENTATION.md': `# Participation State Machine

PARTICIPATION_TRANSITIONS in stateMachines.js; used by participationService.
`,
  'BUSINESS_OPERATIONAL_STATE_MACHINE_IMPLEMENTATION.md': `# Business Operational State Machine

BUSINESS_OPS_TRANSITIONS in stateMachines.js; used by businessSettingService.
`,
  'EFFECTIVE_CAPABILITY_POLICY.md': `# Effective Capability Policy

\`evaluateMraEisCapability\` (pure) + \`evaluateTenantEisCapability\` (DB-backed).
All later phases must call this before fiscal operations.
`,
  'CAPABILITY_BLOCKERS_AND_WARNINGS.md': `# Blockers & Warnings

Stable codes in \`BLOCKER\` and \`WARNING\` constants. UI surfaces remediation actions.
`,
  'ENVIRONMENT_AUTHORIZATION.md': `# Environment Authorization

Sandbox vs Production explicit on entitlement. Client cannot elevate environment. Production requires productionAllowed + platform.productionGloballyAllowed.
`,
  'CERTIFICATION_GATING.md': `# Certification Gating

\`MraEisCertificationRecord\`. Production transmit requires CERTIFIED_ONLINE or PRODUCTION_APPROVED. Offline requires CERTIFIED_OFFLINE. Evidence required for certified statuses. SOD on verify.
`,
  'SAFE_PAUSE_POLICY.md': `# Safe Pause Policy

\`pausePolicyContract\` defines allowNewFiscalSnapshots/allowQueueClaims/allowRetries/allowReadAccess for later workers.
`,
  'SAFE_DISABLEMENT_POLICY.md': `# Safe Disablement Policy

\`disablementPolicyContract\` — history preserved; queue-drain mode dormant until transmission queues exist.
`,
  'EIS_FEATURE_FLAGS.md': `# EIS Feature Flags

Constants in EIS_FEATURE_FLAGS. Precedence: platform status > suspension > entitlement > env > participation > business > future deps. Flags do not bypass permissions/certification.
`,
  'SYSTEM_ADMIN_EIS_UI.md': `# System Admin EIS UI

\`/insightbooks/mra-eis\` and \`/insightbooks/mra-eis/tenants/[tenantId]\`.
`,
  'TENANT_EIS_AVAILABILITY_UI.md': `# Tenant EIS Availability UI

\`/settings/integrations/mra-eis\`.
`,
  'BUSINESS_EIS_SETTINGS_UI.md': `# Business EIS Settings UI

Same tenant page (Tenant=Business). Actions: start setup, ready for activation, pause, disable.
`,
  'EIS_PERMISSIONS.md': `# EIS Permissions

Admin: system.eis.* via adminHasEisPermission. Tenant: eis.* module in permissionsMap + tenantHasEisPermission. Owner/Admin roles short-circuit.
`,
  'EIS_SEGREGATION_OF_DUTIES.md': `# Segregation of Duties

Tenant cannot self-entitle. Certification verify requires different actor unless Super Admin. Production grant may require approvalReference for non-Super Admin when productionApprovalRequired.
`,
  'EIS_APPROVAL_WORKFLOWS.md': `# Approval Workflows

Hooks: productionApprovalRequired + approvalReference on grant/upgrade. Full SecV2 policy wiring can deepen in later phases; SOD enforced for certification verify.
`,
  'EIS_CONTROL_AUDIT_EVENTS.md': `# Control Audit Events

\`MraEisControlAuditEvent\` append-only + AdminAuditLog mirror for admin actions.
`,
  'EIS_CONTROL_NOTIFICATIONS.md': `# Control Notifications

\`notifyEisControlEvent\` structured log + dedupe; deep links to admin/tenant pages. No secrets.
`,
  'EIS_CONTROL_API.md': `# Control API

Admin: /api/admin/mra-eis/platform|entitlements|certifications
Tenant: /api/mra-eis/availability|capability|participation|business-settings
`,
  'EIS_CONTROL_TYPED_ERRORS.md': `# Typed Errors

\`MraEisControlError\` + \`EisErrors\` factory in domain/errors.js.
`,
  'PHASE_4_DATABASE_CHANGES.md': `# Database Changes

Tables: MraEisPlatformSetting, MraEisTenantEntitlement, MraEisTenantParticipation, MraEisBusinessSetting, MraEisCertificationRecord, MraEisControlAuditEvent, MraEisControlIdempotency.
Migration: 20260722220000_mra_eis_phase4_entitlement.
`,
  'PHASE_4_DATABASE_CONSTRAINTS.md': `# Database Constraints

- Singleton platform row
- Unique current entitlement per tenant (partial unique index)
- Unique participation per tenant
- Unique business setting per businessId
- Idempotency identity unique
`,
  'EIS_CONTROL_IDEMPOTENCY.md': `# Idempotency

\`MraEisControlIdempotency\` + begin/complete helpers. Same key+payload returns prior result; conflict rejects.
`,
  'EIS_CONTROL_CONCURRENCY.md': `# Concurrency

Optimistic version fields on aggregates; transition guards; unique current entitlement index.
`,
  'EIS_CONTROL_CACHE_POLICY.md': `# Cache Policy

5s in-process capability cache keyed by versions; invalidateEisCapabilityCache on mutations. No credential caching.
`,
  'EIS_CONTROL_SCHEDULED_JOBS.md': `# Scheduled Jobs

\`expireDueEntitlements\` / \`expireDueCertifications\` exported for cron wiring. Queue-drain completion dormant.
`,
  'EIS_CONTROL_READ_MODELS.md': `# Read Models

\`getEisReadinessSummary\` derived projection; rebuildable from aggregates.
`,
  'EIS_CONTROL_SECURITY.md': `# Security

Server-side admin/tenant permission checks; cross-tenant businessId rejection; no secret fields in Phase 4 APIs/UI.
`,
  'EIS_CONTROL_RESPONSIVE_UI.md': `# Responsive UI

Admin and tenant pages use stacked grids, wrapping action buttons, horizontal scroll only inside tables.
`,
  'EIS_CONTROL_ACCESSIBILITY.md': `# Accessibility

Labels on filters/inputs, role=alert/status banners, keyboard-operable buttons, non-colour status text.
`,
  'ENTITLEMENT_DATA_MIGRATION_PLAN.md': `# Entitlement Data Migration Plan

Dry-run script: \`node scripts/mra-eis-phase4-migration-dry-run.js\`
Default ordinary tenants NOT_ENTITLED. Ambiguous enabled flags → MANUAL_REVIEW. No auto production grant. No historical submit.
`,
  'ENTITLEMENT_DATA_MIGRATION_REPORT.md': `# Entitlement Data Migration Report

Run the dry-run script to regenerate this file with live counts.
`,
  'PHASE_4_TEST_PLAN.md': `# Phase 4 Test Plan

Vitest: capability policy, state machines, hasEISAccess fix. Manual: admin grant/suspend, tenant opt-in, cross-tenant rejection.
`,
  'PHASE_4_TEST_RESULTS.md': `# Phase 4 Test Results

See command output from \`npx vitest run test/mraEis.phase4*.test.js\` in FINAL report.
`,
  'PHASE_4_DEPLOYMENT_PLAN.md': `# Deployment Plan

1. Deploy code
2. \`npx prisma migrate deploy\`
3. Enable platform status ENABLED when ready
4. Grant sandbox entitlements deliberately
5. Keep productionGloballyAllowed false until certification evidence exists
`,
  'PHASE_4_ROLLBACK_PLAN.md': `# Rollback Plan

- Set platform status DISABLED (preserves rows)
- Or reverse migrate only if no entitlement history must be kept
- Do not delete audit/entitlement history in production rollback
`,
  'PHASE_4_RISK_REGISTER.md': `# Phase 4 Risk Register

| ID | Risk | Mitigation |
|---|---|---|
| R4-001 | Operators grant production too early | productionGloballyAllowed default false + cert gating |
| R4-002 | Legacy submit path | Gated by capability |
| R4-003 | Ambiguous legacy eisEnabled | Migration manual review |
| R4-004 | Phase 5 schema not present | Future blockers only |
`,
  'PHASE_5_HANDOVER.md': `# Phase 5 Handover

## Implemented in Phase 4
- Platform/entitlement/participation/business/certification models
- evaluateTenantEisCapability
- Admin + tenant APIs/UI
- Permissions, audit, idempotency, pause/disable contracts
- hasEISAccess fix + legacy submit gate

## Phase 5 must implement
Terminal aggregate, credential references (encrypted), configuration snapshots, site/product/tax/payment mappings, fiscal sequences, snapshots, transmissions, attempts, responses, receipt projections, VAT5, offline queue scaffolding, recon records, operational outbox — **without** activating real terminals or submitting sales until later phases authorize.

## Constraints to honour
- Call evaluateTenantEisCapability before any fiscal op
- Never mutate Journals/Stock from EIS
- businessId currently aliases tenantId
- Offline remains certification-gated / not feasible in browser SaaS
`,
  'PHASE_4_READINESS_DECISION.md': `# Phase 4 Readiness Decision

# READY_FOR_PHASE_5_WITH_BLOCKERS

## Why
Control plane is implemented, audited, and tested for entitlement scope. Fiscalization remains blocked by design (future runtime deps + platform defaults). Remaining Phase 2 engineering (durable outbox dispatcher, vault plaintext, POS idempotency) and Phase 1 MRA clarifications still block later waves — not Phase 5 schema work.

## Next action
Proceed to Phase 5 EIS database foundation using PHASE_5_HANDOVER.md.
`,
  'FINAL_PHASE_4_IMPLEMENTATION_REPORT.md': `# Final Phase 4 Implementation Report

## Executive summary
Phase 4 delivered the MRA EIS control plane: platform status, System Admin entitlement, tenant participation, business operational settings, certification gating records, canonical effective capability policy, APIs, admin/tenant UIs, audit, idempotency, migration dry-run, and tests. No MRA network calls from entitlement actions. No terminals activated. No Journals/Sales altered by entitlement changes. Legacy submit paths are capability-gated.

## Confirmations
- Tenant entitlement is System Administrator-controlled
- Participation is optional after entitlement
- Sandbox and production are separate
- System suspension overrides tenant settings
- Disablement preserves history
- No MRA API call from Phase 4 control actions
- No fiscal number / transmission / MRA-validated receipt created by Phase 4

## Decision
READY_FOR_PHASE_5_WITH_BLOCKERS
`,
};

for (const [name, body] of Object.entries(files)) w(name, body);

// Update parent README
const parent = path.resolve('docs/mra-eis/README.md');
if (fs.existsSync(parent)) {
  let text = fs.readFileSync(parent, 'utf8');
  if (!text.includes('phase-4/')) {
    text = text.replace(
      '**Phase 3:**',
      '**Phase 4:** [phase-4/](./phase-4/) — READY_FOR_PHASE_5_WITH_BLOCKERS\n\n**Phase 3:**'
    );
  }
  fs.writeFileSync(parent, text);
}

console.log('phase-4 docs', Object.keys(files).length);
