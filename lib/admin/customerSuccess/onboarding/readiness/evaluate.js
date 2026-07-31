/**
 * Aggregate onboarding readiness evaluation — UNKNOWN never treated as READY.
 * Fresh evaluation must not lift live UNKNOWN to READY from a stored snapshot.
 */

import { loadOnboardingProjectForActor } from '../projectAccess.js';
import {
  canManageOnboarding,
  hasCustomerOnboardingReadinessEvaluationModel,
  resolveOnboardingActor,
} from '../model.js';
import { getOnboardingDomainContract } from '../catalogue.js';
import { evaluateTenantReadiness, READINESS_STATUS } from './tenant.js';
import { evaluateBusinessBranchReadiness } from './businessBranch.js';
import { evaluateUsersReadiness } from './users.js';
import { evaluateConfigurationReadiness } from './configuration.js';
import { evaluateAccountingReadiness } from './accounting.js';
import { evaluateProvisioningReadiness } from './provisioning.js';
import { evaluateSubscriptionReadiness } from './subscription.js';
import { evaluateEntitlementReadiness } from './entitlement.js';
import { evaluateIntegrationReadiness } from './integration.js';

const READINESS_RULES_VERSION = 'onboarding-readiness-v2';

const CORE_DIMENSIONS = [
  'tenant',
  'provisioning',
  'subscription',
  'entitlements',
  'businessBranch',
  'users',
  'configuration',
  'accounting',
  'migration',
  'integrations',
  'mraEis',
  'training',
  'testing',
  'defects',
];

/** Statuses that allow go-live approve / execute / outcome per policy. */
export function isGoLiveReadinessAllowed(overallStatus) {
  const s = String(overallStatus || '').toUpperCase();
  return (
    s === READINESS_STATUS.READY || s === 'READY_WITH_WARNINGS'
  );
}

function overallFromDimensions(dimensions) {
  const values = Object.values(dimensions).map((v) =>
    String(v || READINESS_STATUS.UNKNOWN).toUpperCase()
  );
  if (values.some((v) => v === READINESS_STATUS.NOT_READY)) {
    return READINESS_STATUS.NOT_READY;
  }
  if (values.some((v) => v === READINESS_STATUS.UNKNOWN)) {
    return READINESS_STATUS.UNKNOWN;
  }
  if (
    values.every(
      (v) =>
        v === READINESS_STATUS.READY || v === READINESS_STATUS.NOT_APPLICABLE
    )
  ) {
    return READINESS_STATUS.READY;
  }
  return READINESS_STATUS.UNKNOWN;
}

async function loadLatestStoredEvaluation(prisma, projectId) {
  if (!hasCustomerOnboardingReadinessEvaluationModel(prisma)) return null;
  if (typeof prisma.customerOnboardingReadinessEvaluation.findFirst === 'function') {
    return prisma.customerOnboardingReadinessEvaluation.findFirst({
      where: { projectId },
    });
  }
  if (typeof prisma.customerOnboardingReadinessEvaluation.findMany === 'function') {
    const rows = await prisma.customerOnboardingReadinessEvaluation.findMany({
      where: { projectId },
    });
    return rows[rows.length - 1] || null;
  }
  return null;
}

const MIGRATION_RECON_OK = new Set(['PASSED', 'COMPLETE', 'OK', 'APPROVED']);

function migrationReconReady(mig) {
  const recon = String(mig?.reconciliationStatus || '').toUpperCase();
  const reconStarted =
    mig?.reconStarted === true ||
    Boolean(mig?.reconciliationStartedAt) ||
    MIGRATION_RECON_OK.has(recon) ||
    recon === 'IN_PROGRESS' ||
    recon === 'STARTED';
  const reconPassed = MIGRATION_RECON_OK.has(recon);
  return { reconStarted, reconPassed, recon };
}

async function evaluateMigrationDim(prisma, projectId, overrides) {
  if (overrides?.migration) {
    return String(overrides.migration).toUpperCase();
  }
  if (typeof prisma?.customerOnboardingMigration?.findFirst !== 'function') {
    return READINESS_STATUS.UNKNOWN;
  }
  const mig = await prisma.customerOnboardingMigration.findFirst({
    where: { projectId },
  });
  if (!mig) return READINESS_STATUS.UNKNOWN;
  const status = String(mig.status || '').toUpperCase();
  if (status === 'NOT_APPLICABLE' || status === 'N/A' || status === 'NOT_REQUIRED') {
    return READINESS_STATUS.NOT_APPLICABLE;
  }

  const { reconPassed, reconStarted } = migrationReconReady(mig);

  // COMPLETED / READY / READY_FOR_IMPORT require reconciliation when financial/recon applies
  if (
    status === 'COMPLETED' ||
    status === 'READY' ||
    status === 'READY_FOR_IMPORT'
  ) {
    if (reconPassed) return READINESS_STATUS.READY;
    // Coordination "READY" without recon must never green-light go-live
    return READINESS_STATUS.NOT_READY;
  }

  if (status === 'RECONCILING') {
    return reconPassed
      ? READINESS_STATUS.READY
      : reconStarted
        ? READINESS_STATUS.NOT_READY
        : READINESS_STATUS.NOT_READY;
  }

  if (status === 'IN_PROGRESS' || status === 'DRY_RUN') {
    return READINESS_STATUS.NOT_READY;
  }
  return READINESS_STATUS.UNKNOWN;
}

/**
 * Training go-live dimension: only authoritative Training-domain COMPLETED
 * or NOT_REQUIRED / WAIVED_WITH_APPROVAL count as READY/NOT_APPLICABLE.
 * Phase 18 stub UNKNOWN / IN_PROGRESS remain non-READY.
 */
async function evaluateTrainingDim(prisma, projectId, overrides) {
  if (overrides?.training) return String(overrides.training).toUpperCase();
  if (typeof prisma?.customerOnboardingTraining?.findFirst !== 'function') {
    return READINESS_STATUS.UNKNOWN;
  }
  const trn = await prisma.customerOnboardingTraining.findFirst({
    where: { projectId },
  });
  if (!trn) return READINESS_STATUS.UNKNOWN;

  const status = String(trn.status || '').toUpperCase();
  const domainStatus = String(trn.trainingDomainStatus || '').toUpperCase();
  const domainSource = String(trn.trainingDomainSource || '').toUpperCase();

  if (
    status === 'NOT_REQUIRED' ||
    status === 'WAIVED_WITH_APPROVAL' ||
    status === 'NOT_APPLICABLE'
  ) {
    return READINESS_STATUS.NOT_APPLICABLE;
  }

  if (status === 'COMPLETED') {
    const authoritative =
      domainStatus === 'COMPLETED' &&
      (domainSource.includes('PHASE_18') ||
        domainSource.includes('PHASE_22') ||
        domainSource.includes('TRAINING') ||
        domainSource === 'CUSTOMER_TRAINING');
    return authoritative ? READINESS_STATUS.READY : READINESS_STATUS.NOT_READY;
  }

  // IN_PROGRESS / READY coordination without Training-domain COMPLETED → non-READY
  if (status === 'IN_PROGRESS' || status === 'READY') {
    return READINESS_STATUS.NOT_READY;
  }

  return READINESS_STATUS.UNKNOWN;
}

async function evaluateMraDim(prisma, projectId, overrides) {
  if (overrides?.mraEis) return String(overrides.mraEis).toUpperCase();
  if (typeof prisma?.customerOnboardingMraEis?.findFirst !== 'function') {
    return READINESS_STATUS.UNKNOWN;
  }
  const mra = await prisma.customerOnboardingMraEis.findFirst({
    where: { projectId },
  });
  if (!mra) return READINESS_STATUS.NOT_APPLICABLE;
  const status = String(mra.status || '').toUpperCase();
  if (status === 'READY' || status === 'COMPLETED' || status === 'NOT_REQUIRED') {
    return status === 'NOT_REQUIRED'
      ? READINESS_STATUS.NOT_APPLICABLE
      : READINESS_STATUS.READY;
  }
  if (status === 'UNKNOWN') return READINESS_STATUS.UNKNOWN;
  return READINESS_STATUS.NOT_READY;
}

async function evaluateTestingDim(prisma, projectId, overrides) {
  if (overrides?.testing) return String(overrides.testing).toUpperCase();
  if (typeof prisma?.customerOnboardingTestPlan?.findFirst !== 'function') {
    return READINESS_STATUS.UNKNOWN;
  }
  const plan = await prisma.customerOnboardingTestPlan.findFirst({
    where: { projectId },
  });
  if (!plan) return READINESS_STATUS.UNKNOWN;
  const status = String(plan.status || '').toUpperCase();
  if (status === 'PASSED' || status === 'READY' || status === 'COMPLETED') {
    return READINESS_STATUS.READY;
  }
  if (status === 'NOT_REQUIRED' || status === 'NOT_APPLICABLE') {
    return READINESS_STATUS.NOT_APPLICABLE;
  }
  return READINESS_STATUS.NOT_READY;
}

async function evaluateDefectsDim(prisma, projectId, overrides) {
  if (overrides?.defects) return String(overrides.defects).toUpperCase();
  if (typeof prisma?.customerOnboardingDefect?.findMany !== 'function') {
    return READINESS_STATUS.UNKNOWN;
  }
  // Critical + High open defects → NOT_READY (UNKNOWN never treated as READY).
  const openRows = await prisma.customerOnboardingDefect.findMany({
    where: { projectId },
  });
  const blocking = (openRows || []).filter((d) => {
    const sev = String(d.severity || '').toUpperCase();
    if (sev !== 'CRITICAL' && sev !== 'HIGH') return false;
    const s = String(d.status || 'OPEN').toUpperCase();
    return s === 'OPEN' || s === 'IN_PROGRESS' || s === 'BLOCKING';
  });
  if (blocking.length > 0) return READINESS_STATUS.NOT_READY;
  return READINESS_STATUS.READY;
}

/**
 * Evaluate readiness dimensions for a project. UNKNOWN ≠ READY.
 * Stored snapshots are audit history only — never lift live UNKNOWN → READY.
 */
export async function evaluateOnboardingReadiness(prisma, args = {}) {
  const loaded = await loadOnboardingProjectForActor(prisma, args);
  if (!loaded.ok) return loaded;

  const { project } = loaded;
  const stored = await loadLatestStoredEvaluation(prisma, project.id);

  // Explicit caller overrides only — do not merge stored READY dims into live eval
  const overrides = { ...(args.dimensionOverrides || {}) };

  const tenant = await evaluateTenantReadiness(prisma, project, {
    dimensionOverrides: overrides,
  });
  const provisioning = await evaluateProvisioningReadiness(prisma, project, {
    dimensionOverrides: overrides,
    provisioningStatus: args.provisioningStatus,
    providerResult: args.providerResult,
  });
  const subscription = await evaluateSubscriptionReadiness(prisma, project, {
    dimensionOverrides: overrides,
  });
  const entitlements = await evaluateEntitlementReadiness(prisma, project, {
    dimensionOverrides: overrides,
  });
  const businessBranch = await evaluateBusinessBranchReadiness(prisma, project, {
    dimensionOverrides: overrides,
  });
  const users = await evaluateUsersReadiness(prisma, project, {
    dimensionOverrides: overrides,
  });
  const configuration = await evaluateConfigurationReadiness(prisma, project, {
    dimensionOverrides: overrides,
  });
  const accounting = await evaluateAccountingReadiness(prisma, project, {
    dimensionOverrides: overrides,
    accountingChecklistComplete: overrides.accounting === 'READY',
  });
  const integrations = await evaluateIntegrationReadiness(prisma, project, {
    dimensionOverrides: overrides,
    integrationConfig: args.integrationConfig,
  });

  const dimensions = {
    tenant: tenant.status,
    provisioning: provisioning.status,
    subscription: subscription.status,
    entitlements: entitlements.status,
    businessBranch: businessBranch.status,
    users: users.status,
    configuration: configuration.status,
    accounting: accounting.status,
    migration: await evaluateMigrationDim(prisma, project.id, overrides),
    integrations: integrations.status,
    mraEis: await evaluateMraDim(prisma, project.id, overrides),
    training: await evaluateTrainingDim(prisma, project.id, overrides),
    testing: await evaluateTestingDim(prisma, project.id, overrides),
    defects: await evaluateDefectsDim(prisma, project.id, overrides),
    customerApproval: overrides.customerApproval || READINESS_STATUS.UNKNOWN,
    internalApproval: overrides.internalApproval || READINESS_STATUS.UNKNOWN,
  };

  const overallStatus = overallFromDimensions(
    Object.fromEntries(CORE_DIMENSIONS.map((k) => [k, dimensions[k]]))
  );

  const ready = isGoLiveReadinessAllowed(overallStatus);

  const admin = resolveOnboardingActor(args);
  if (
    canManageOnboarding(admin) &&
    hasCustomerOnboardingReadinessEvaluationModel(prisma) &&
    args.persist !== false
  ) {
    await prisma.customerOnboardingReadinessEvaluation.create({
      data: {
        projectId: project.id,
        overallStatus,
        dimensionsJson: dimensions,
        rulesVersion: READINESS_RULES_VERSION,
        createdByAdminId: admin?.id || null,
        createdAt: args.now || new Date(),
        updatedAt: args.now || new Date(),
      },
    });
  }

  return {
    ok: true,
    projectId: project.id,
    overallStatus,
    ready,
    dimensions,
    rulesVersion: READINESS_RULES_VERSION,
    storedEvaluationId: stored?.id || null,
    domain: getOnboardingDomainContract(),
  };
}

export { READINESS_STATUS, READINESS_RULES_VERSION, CORE_DIMENSIONS };
