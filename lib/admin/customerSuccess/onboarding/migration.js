/**
 * Migration coordination — Phase 17 Wave 3.
 * File inventory metadata + security flags; recon gate blocks COMPLETED.
 * Does not replace the migration engine.
 */

import { loadOnboardingProjectForActor } from './projectAccess.js';
import {
  canManageOnboarding,
  hasCustomerOnboardingMigrationModel,
  serializeOnboardingMigration,
} from './model.js';
import { getOnboardingDomainContract } from './catalogue.js';

export const MIGRATION_STATUS = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  DRY_RUN: 'DRY_RUN',
  RECONCILING: 'RECONCILING',
  READY: 'READY',
  READY_FOR_IMPORT: 'READY_FOR_IMPORT',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

const RECON_OK = new Set(['PASSED', 'COMPLETE', 'OK', 'APPROVED']);
const RECON_REQUIRED_STATUSES = new Set([
  MIGRATION_STATUS.COMPLETED,
  MIGRATION_STATUS.READY,
  MIGRATION_STATUS.READY_FOR_IMPORT,
]);

export async function setMigrationCoordinationStatus(prisma, args = {}) {
  const loaded = await loadOnboardingProjectForActor(prisma, args);
  if (!loaded.ok) return loaded;
  if (!canManageOnboarding(loaded.admin)) {
    return { ok: false, forbidden: true, error: 'onboarding_migration_forbidden' };
  }
  if (!hasCustomerOnboardingMigrationModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_migration_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const status = String(args.status || '')
    .trim()
    .toUpperCase();
  if (!status) return { ok: false, error: 'status_required' };

  if (RECON_REQUIRED_STATUSES.has(status)) {
    const recon = String(args.reconciliationStatus || '')
      .trim()
      .toUpperCase();
    if (!RECON_OK.has(recon)) {
      return {
        ok: false,
        error: 'migration_ready_requires_reconciliation',
        reconciliationStatus: args.reconciliationStatus || null,
      };
    }
  }

  const now = args.now || new Date();
  const existing = await prisma.customerOnboardingMigration.findFirst({
    where: { projectId: loaded.project.id },
  });

  const data = {
    projectId: loaded.project.id,
    status,
    reconciliationStatus:
      args.reconciliationStatus != null
        ? String(args.reconciliationStatus).trim().toUpperCase()
        : existing?.reconciliationStatus || null,
    fileInventoryJson:
      args.fileInventoryJson !== undefined
        ? args.fileInventoryJson
        : existing?.fileInventoryJson ?? null,
    securityFlagsJson:
      args.securityFlagsJson !== undefined
        ? args.securityFlagsJson
        : existing?.securityFlagsJson ?? {
            privateStorage: true,
            publicUrlForbidden: true,
            credentialsForbidden: true,
          },
    engineStatus: args.engineStatus || 'NOT_AVAILABLE',
    updatedAt: now,
  };

  let row;
  if (existing) {
    row = await prisma.customerOnboardingMigration.update({
      where: { id: existing.id },
      data,
    });
  } else {
    row = await prisma.customerOnboardingMigration.create({
      data: {
        ...data,
        createdByAdminId: loaded.admin?.id || null,
        createdAt: now,
      },
    });
  }

  return {
    ok: true,
    migration: serializeOnboardingMigration(row),
    domain: getOnboardingDomainContract(),
  };
}

/**
 * Phase 21 Wave 2 (G21-13) — explicit refuse of unsafe browser import engine.
 * Onboarding may coordinate/reconcile only; never execute browser-side import.
 */
export async function runOnboardingBrowserImport(_prisma, _args = {}) {
  return {
    ok: false,
    error: 'browser_import_forbidden',
    reason: 'onboarding_migration_coordinate_reconcile_only',
    engineStatus: 'NOT_AVAILABLE',
  };
}

export function assertMigrationCoordinationOnly(args = {}) {
  const mode = String(args.mode || args.action || '')
    .trim()
    .toUpperCase();
  if (
    mode.includes('BROWSER') ||
    mode.includes('IMPORT_ENGINE') ||
    mode === 'EXECUTE_IMPORT' ||
    mode === 'UNSAFE_IMPORT'
  ) {
    return {
      ok: false,
      error: 'browser_import_forbidden',
      reason: 'onboarding_migration_coordinate_reconcile_only',
    };
  }
  return { ok: true, mode: mode || 'COORDINATE' };
}
