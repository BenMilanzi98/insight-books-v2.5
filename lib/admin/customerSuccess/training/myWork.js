/**
 * Training My Work — Phase 18 Wave 4.
 * Portfolio + owner scoped: excludes other CS owners' programs and out-of-portfolio tenants.
 */

import {
  canViewTraining,
  hasCustomerTrainingProgramModel,
  resolveTrainingActor,
  serializeTrainingProgram,
} from './model.js';
import { getTrainingDomainContract } from './catalogue.js';
import {
  applyTrainingReportHonesty,
  TRAINING_REPORT_STATUS,
} from './reliabilityGate.js';
import {
  resolveTrainingListScope,
  tenantWhereFromScope,
} from './listScope.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, actorContext?: object }} args
 */
export async function getTrainingMyWork(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canViewTraining(admin)) {
    const honesty = applyTrainingReportHonesty({ permissionOk: false });
    return {
      ok: false,
      forbidden: true,
      status: honesty.status,
      count: null,
      programs: [],
      honesty,
    };
  }

  if (!hasCustomerTrainingProgramModel(prisma)) {
    const honesty = applyTrainingReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      count: null,
      programs: [],
      honesty,
      reason: 'customer_training_program_model_unavailable',
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
      count: null,
      programs: [],
      honesty,
      reason: scopeResult.reason,
      meta: { portfolioScoped: true, failClosed: true },
    };
  }

  const ownerId = admin?.id ? String(admin.id) : '';
  if (!ownerId) {
    return {
      ok: true,
      status: TRAINING_REPORT_STATUS.EMPTY,
      count: 0,
      programs: [],
      honesty: { inventZeroesForbidden: true, falseZeroes: false },
    };
  }

  try {
    const scopeWhere = tenantWhereFromScope(scopeResult.tenantScope);
    const rows = await prisma.customerTrainingProgram.findMany({
      where: {
        ...scopeWhere,
        OR: [{ csOwnerAdminId: ownerId }, { ownerAdminId: ownerId }],
      },
    });

    const mine = (rows || []).filter((r) => {
      const cs = r.csOwnerAdminId || r.ownerAssignmentsJson?.csOwnerAdminId;
      const owner = r.ownerAdminId || r.ownerAssignmentsJson?.ownerAdminId;
      // Column pins required — JSON-only ownership is not My Work
      return (
        (r.csOwnerAdminId === ownerId || r.ownerAdminId === ownerId) &&
        (cs === ownerId || owner === ownerId)
      );
    });

    return {
      ok: true,
      status: TRAINING_REPORT_STATUS.READY,
      count: mine.length,
      programs: mine.map((r) => serializeTrainingProgram(r)),
      honesty: {
        inventZeroesForbidden: true,
        falseZeroes: false,
        portfolioScoped: Boolean(scopeResult.portfolioScoped || scopeResult.isSuperAdmin),
      },
      domain: getTrainingDomainContract(),
      meta: { portfolioScoped: scopeResult.portfolioScoped },
    };
  } catch {
    const honesty = applyTrainingReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: honesty.status,
      count: null,
      programs: [],
      honesty,
      reason: 'my_work_query_failed',
    };
  }
}
