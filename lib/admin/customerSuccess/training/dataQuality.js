/**
 * Training data-quality foundations — Phase 22 Wave 4 harden.
 * Never invent DQ scores or false zeroes on gate failure.
 * Portfolio-scoped for non–Super Admin (fail-closed empty scope).
 */

import {
  canViewTraining,
  hasCustomerTrainingProgramModel,
  hasCustomerTrainingRequestModel,
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

export const TRAINING_DQ_VERSION = 'cs-training-dq-v1-2026-07-31';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, portfolioTenantIds?: string[] }} args
 */
export async function runTrainingDataQuality(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canViewTraining(admin)) {
    return {
      ok: false,
      forbidden: true,
      status: TRAINING_REPORT_STATUS.UNAVAILABLE,
      checks: null,
      reason: 'training_dq_forbidden',
    };
  }

  if (!hasCustomerTrainingProgramModel(prisma)) {
    const honesty = applyTrainingReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      checks: null,
      honesty,
      definitionVersion: TRAINING_DQ_VERSION,
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
      checks: null,
      honesty,
      reason: scopeResult.reason,
      definitionVersion: TRAINING_DQ_VERSION,
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
      checks: null,
      honesty,
      definitionVersion: TRAINING_DQ_VERSION,
      domain: getTrainingDomainContract(),
    };
  }

  // Request model missing / gate fail → UNAVAILABLE + null — never invent 0.
  if (!hasCustomerTrainingRequestModel(prisma)) {
    const honesty = applyTrainingReportHonesty({
      modelAvailable: false,
      queryOk: true,
      permissionOk: true,
    });
    return {
      ok: true,
      status: TRAINING_REPORT_STATUS.UNAVAILABLE,
      checks: {
        totalPrograms: programs.value,
        totalRequests: null,
        orphanedRequests: null,
        blockingDq: null,
        blockingDqStatus: TRAINING_REPORT_STATUS.UNAVAILABLE,
      },
      honesty: {
        ...honesty,
        inventZeroesForbidden: true,
        falseZeroes: false,
      },
      reason: 'customer_training_request_model_unavailable',
      definitionVersion: TRAINING_DQ_VERSION,
      domain: getTrainingDomainContract(),
      meta: { portfolioScoped: scopeResult.portfolioScoped },
    };
  }

  const requests = await safeTrainingCount(() =>
    prisma.customerTrainingRequest.count({ where: scopeWhere })
  );
  if (!requests.ok) {
    const honesty = applyTrainingReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: honesty.status,
      checks: {
        totalPrograms: programs.value,
        totalRequests: null,
        orphanedRequests: null,
        blockingDq: null,
        blockingDqStatus: TRAINING_REPORT_STATUS.UNAVAILABLE,
      },
      honesty: {
        ...honesty,
        inventZeroesForbidden: true,
        falseZeroes: false,
      },
      reason: 'training_dq_request_query_failed',
      definitionVersion: TRAINING_DQ_VERSION,
      domain: getTrainingDomainContract(),
      meta: { portfolioScoped: scopeResult.portfolioScoped },
    };
  }

  // Counts are real; orphaned/blocking DQ checks are not instrumented — null + UNAVAILABLE.
  return {
    ok: true,
    status: TRAINING_REPORT_STATUS.READY,
    checks: {
      totalPrograms: programs.value,
      totalRequests: requests.value,
      orphanedRequests: null,
      orphanedRequestsStatus: TRAINING_REPORT_STATUS.UNAVAILABLE,
      blockingDq: null,
      blockingDqStatus: TRAINING_REPORT_STATUS.UNAVAILABLE,
    },
    honesty: {
      inventZeroesForbidden: true,
      falseZeroes: false,
      portfolioScoped: scopeResult.portfolioScoped,
      thinInstrumentation: true,
    },
    definitionVersion: TRAINING_DQ_VERSION,
    domain: getTrainingDomainContract(),
    meta: { portfolioScoped: scopeResult.portfolioScoped },
  };
}
