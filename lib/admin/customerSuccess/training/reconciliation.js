/**
 * Training reconciliation — Phase 22 Wave 4 harden.
 * Handoff ↔ request ↔ program ↔ Phase 8 link ↔ completion ↔ certificate.
 * Never invent zeroes on gate failure; never invent lineageIntact: true.
 * Portfolio-scoped for non–Super Admin (fail-closed empty scope).
 */

import {
  canViewTraining,
  hasCustomerTrainingProgramModel,
  resolveTrainingActor,
} from './model.js';
import { getTrainingDomainContract } from './catalogue.js';
import {
  applyTrainingReportHonesty,
  safeTrainingCount,
  TRAINING_REPORT_STATUS,
} from './reliabilityGate.js';
import {
  resolveTrainingListScope,
  tenantWhereFromScope,
} from './listScope.js';

export const TRAINING_RECON_VERSION = 'cs-training-recon-v1-2026-07-31';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, portfolioTenantIds?: string[] }} args
 */
export async function runTrainingReconciliation(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canViewTraining(admin)) {
    return {
      ok: false,
      forbidden: true,
      status: TRAINING_REPORT_STATUS.UNAVAILABLE,
      cards: null,
      reason: 'training_recon_forbidden',
    };
  }

  if (!hasCustomerTrainingProgramModel(prisma)) {
    const honesty = applyTrainingReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      cards: null,
      honesty,
      definitionVersion: TRAINING_RECON_VERSION,
      domain: getTrainingDomainContract(),
    };
  }

  const scopeResult = await resolveTrainingListScope(prisma, admin, args);
  if (!scopeResult.ok) {
    const honesty = applyTrainingReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: !scopeResult.forbidden,
    });
    return {
      ok: scopeResult.forbidden ? false : true,
      forbidden: Boolean(scopeResult.forbidden),
      status: TRAINING_REPORT_STATUS.UNAVAILABLE,
      cards: null,
      honesty,
      reason: scopeResult.reason,
      definitionVersion: TRAINING_RECON_VERSION,
      domain: getTrainingDomainContract(),
      meta: { portfolioScoped: true, failClosed: true },
    };
  }

  const scopeWhere = tenantWhereFromScope(scopeResult.tenantScope);
  const programs = await safeTrainingCount(() =>
    prisma.customerTrainingProgram.count({ where: scopeWhere })
  );
  if (!programs.ok) {
    const honesty = applyTrainingReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: honesty.status,
      cards: null,
      honesty,
      definitionVersion: TRAINING_RECON_VERSION,
      domain: getTrainingDomainContract(),
    };
  }

  // Thin stub: programs count is real; lineage integrity is not instrumented —
  // never invent lineageIntact: true. Null + UNAVAILABLE for that check.
  return {
    ok: true,
    status: TRAINING_REPORT_STATUS.READY,
    cards: {
      programs: programs.value,
      phase8Linked: null,
      lineageIntact: null,
      lineageIntactStatus: TRAINING_REPORT_STATUS.UNAVAILABLE,
    },
    honesty: {
      inventZeroesForbidden: true,
      falseZeroes: false,
      portfolioScoped: scopeResult.portfolioScoped,
      thinInstrumentation: true,
    },
    definitionVersion: TRAINING_RECON_VERSION,
    domain: getTrainingDomainContract(),
    meta: { portfolioScoped: scopeResult.portfolioScoped },
  };
}
