/**
 * Training metrics — Phase 22 Wave 4 harden.
 * Reliability-gated; gate fail ≠ fabricated zero.
 * Portfolio-scoped for non–Super Admin (same fail-closed rules as list/search).
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
  gatedMetricCard,
  TRAINING_REPORT_STATUS,
} from './reliabilityGate.js';
import {
  resolveTrainingListScope,
  tenantWhereFromScope,
} from './listScope.js';

export const TRAINING_METRIC_VERSION = 'cs-training-metric-v1-2026-07-31';

function unavailableCards(honesty) {
  return {
    inProgress: gatedMetricCard({
      label: 'in_progress',
      counted: { ok: false, value: null },
      honesty,
    }),
    atRisk: gatedMetricCard({
      label: 'at_risk',
      counted: { ok: false, value: null },
      honesty,
    }),
    scheduling: gatedMetricCard({
      label: 'scheduling',
      counted: { ok: false, value: null },
      honesty,
    }),
    completed: gatedMetricCard({
      label: 'completed',
      counted: { ok: false, value: null },
      honesty,
    }),
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, actorContext?: object, metric?: string, portfolioTenantIds?: string[] }} args
 */
export async function getTrainingMetric(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canViewTraining(admin)) {
    const honesty = applyTrainingReportHonesty({ permissionOk: false });
    return {
      ok: false,
      forbidden: true,
      status: honesty.status,
      value: null,
      honesty,
      definitionVersion: TRAINING_METRIC_VERSION,
    };
  }

  if (!hasCustomerTrainingProgramModel(prisma)) {
    const honesty = applyTrainingReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      value: null,
      honesty,
      reason: 'customer_training_program_model_unavailable',
      definitionVersion: TRAINING_METRIC_VERSION,
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
      value: null,
      honesty,
      reason: scopeResult.reason,
      definitionVersion: TRAINING_METRIC_VERSION,
      domain: getTrainingDomainContract(),
      meta: { portfolioScoped: true, failClosed: true },
    };
  }

  const metric = String(args.metric || 'program_count').trim().toLowerCase();
  const where = { ...tenantWhereFromScope(scopeResult.tenantScope) };
  const counted = await safeTrainingCount(() =>
    prisma.customerTrainingProgram.count({ where })
  );

  if (!counted.ok) {
    const honesty = applyTrainingReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: honesty.status,
      value: null,
      honesty,
      reason: 'training_metric_query_failed',
      definitionVersion: TRAINING_METRIC_VERSION,
      domain: getTrainingDomainContract(),
    };
  }

  const honesty = applyTrainingReportHonesty({
    modelAvailable: true,
    queryOk: true,
    permissionOk: true,
  });

  return {
    ok: true,
    status: TRAINING_REPORT_STATUS.READY,
    metric,
    value: counted.value,
    honesty: {
      ...honesty,
      reliability: 'AVAILABLE',
      portfolioScoped: scopeResult.portfolioScoped,
    },
    definitionVersion: TRAINING_METRIC_VERSION,
    domain: getTrainingDomainContract(),
  };
}

/**
 * Overview queue cards — each value reliability-gated and portfolio-scoped.
 */
export async function getTrainingOverviewCards(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canViewTraining(admin)) {
    const honesty = applyTrainingReportHonesty({ permissionOk: false });
    return {
      ok: false,
      forbidden: true,
      status: honesty.status,
      cards: null,
      honesty,
    };
  }

  if (!hasCustomerTrainingProgramModel(prisma)) {
    const honesty = applyTrainingReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      cards: unavailableCards(honesty),
      honesty,
      definitionVersion: TRAINING_METRIC_VERSION,
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
      cards: unavailableCards(honesty),
      honesty,
      reason: scopeResult.reason,
      definitionVersion: TRAINING_METRIC_VERSION,
      domain: getTrainingDomainContract(),
      meta: { portfolioScoped: true, failClosed: true },
    };
  }

  const scopeWhere = tenantWhereFromScope(scopeResult.tenantScope);
  const counts = await Promise.all([
    safeTrainingCount(() =>
      prisma.customerTrainingProgram.count({
        where: { ...scopeWhere, status: 'IN_PROGRESS' },
      })
    ),
    safeTrainingCount(() =>
      prisma.customerTrainingProgram.count({
        where: { ...scopeWhere, status: 'AT_RISK' },
      })
    ),
    safeTrainingCount(() =>
      prisma.customerTrainingProgram.count({
        where: { ...scopeWhere, status: 'SCHEDULING' },
      })
    ),
    safeTrainingCount(() =>
      prisma.customerTrainingProgram.count({
        where: { ...scopeWhere, status: 'COMPLETED' },
      })
    ),
  ]);

  const anyFail = counts.some((c) => !c.ok);
  if (anyFail) {
    const honesty = applyTrainingReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: TRAINING_REPORT_STATUS.UNAVAILABLE,
      cards: unavailableCards(honesty),
      honesty,
      definitionVersion: TRAINING_METRIC_VERSION,
      domain: getTrainingDomainContract(),
    };
  }

  const honesty = applyTrainingReportHonesty({
    modelAvailable: true,
    queryOk: true,
    permissionOk: true,
  });

  return {
    ok: true,
    status: TRAINING_REPORT_STATUS.READY,
    cards: {
      inProgress: gatedMetricCard({
        label: 'in_progress',
        counted: counts[0],
        honesty,
      }),
      atRisk: gatedMetricCard({
        label: 'at_risk',
        counted: counts[1],
        honesty,
      }),
      scheduling: gatedMetricCard({
        label: 'scheduling',
        counted: counts[2],
        honesty,
      }),
      completed: gatedMetricCard({
        label: 'completed',
        counted: counts[3],
        honesty,
      }),
    },
    honesty: {
      ...honesty,
      reliability: 'AVAILABLE',
      portfolioScoped: scopeResult.portfolioScoped,
    },
    definitionVersion: TRAINING_METRIC_VERSION,
    domain: getTrainingDomainContract(),
  };
}
