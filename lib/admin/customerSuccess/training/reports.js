/**
 * Training report catalogue — Phase 18 Wave 4 / Phase 22 harden.
 * Subset: Overview, At-Risk, Scheduling, Completion, Certificates.
 * Portfolio/tenant fail-closed — never global unscoped counts for CS actors.
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

export const TRAINING_REPORT_VERSION = 'cs-training-report-v1-2026-07-31';

export const TRAINING_REPORT_CATALOGUE = Object.freeze([
  { key: 'overview', title: 'Training Overview' },
  { key: 'at-risk', title: 'At-Risk Training' },
  { key: 'scheduling', title: 'Scheduling Queue' },
  { key: 'completion', title: 'Training Completion' },
  { key: 'certificates', title: 'Certificates Issued' },
]);

export function listTrainingReports() {
  return TRAINING_REPORT_CATALOGUE.map((r) => ({ ...r }));
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, reportKey?: string, portfolioTenantIds?: string[] }} args
 */
export async function getTrainingReport(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canViewTraining(admin)) {
    const honesty = applyTrainingReportHonesty({ permissionOk: false });
    return {
      ok: false,
      forbidden: true,
      status: honesty.status,
      report: null,
      honesty,
    };
  }

  if (!hasCustomerTrainingProgramModel(prisma)) {
    const honesty = applyTrainingReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      report: null,
      honesty,
      definitionVersion: TRAINING_REPORT_VERSION,
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
      report: null,
      honesty,
      reason: scopeResult.reason,
      definitionVersion: TRAINING_REPORT_VERSION,
      domain: getTrainingDomainContract(),
      meta: { portfolioScoped: true, failClosed: true },
    };
  }

  const reportKey = String(args.reportKey || 'overview').trim().toLowerCase();
  const where = { ...tenantWhereFromScope(scopeResult.tenantScope) };
  const total = await safeTrainingCount(() =>
    prisma.customerTrainingProgram.count({ where })
  );
  if (!total.ok) {
    const honesty = applyTrainingReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: honesty.status,
      report: null,
      honesty,
      definitionVersion: TRAINING_REPORT_VERSION,
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
    status:
      total.value === 0
        ? TRAINING_REPORT_STATUS.EMPTY
        : TRAINING_REPORT_STATUS.READY,
    report: {
      key: reportKey,
      title:
        TRAINING_REPORT_CATALOGUE.find((r) => r.key === reportKey)?.title ||
        reportKey,
      kpis: { totalPrograms: total.value },
    },
    honesty: { ...honesty, reliability: 'AVAILABLE' },
    definitionVersion: TRAINING_REPORT_VERSION,
    domain: getTrainingDomainContract(),
    meta: {
      portfolioScoped: Boolean(scopeResult.portfolioScoped),
      failClosed: true,
    },
  };
}
