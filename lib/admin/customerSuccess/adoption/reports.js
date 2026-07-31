/**
 * Adoption report catalogue — Phase 19 Wave 4.
 */

import {
  canViewAdoption,
  hasCustomerAdoptionPlanModel,
  resolveAdoptionActor,
} from './model.js';
import { getAdoptionDomainContract } from './catalogue.js';
import {
  applyAdoptionReportHonesty,
  safeAdoptionCount,
  ADOPTION_REPORT_STATUS,
} from './reliabilityGate.js';

export const ADOPTION_REPORT_VERSION = 'cs-adoption-report-v1-2026-07-31';

export const ADOPTION_REPORT_CATALOGUE = Object.freeze([
  { key: 'overview', title: 'Adoption Overview' },
  { key: 'at-risk', title: 'At-Risk Adoption Plans' },
  { key: 'dormancy', title: 'Dormancy Attention' },
  { key: 'value-review', title: 'Value Review Queue' },
  { key: 'expansion', title: 'Expansion Handoffs' },
]);

export function listAdoptionReports() {
  return ADOPTION_REPORT_CATALOGUE.map((r) => ({ ...r }));
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, reportKey?: string }} args
 */
export async function getAdoptionReport(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canViewAdoption(admin)) {
    const honesty = applyAdoptionReportHonesty({ permissionOk: false });
    return {
      ok: false,
      forbidden: true,
      status: honesty.status,
      report: null,
      honesty,
    };
  }

  if (!hasCustomerAdoptionPlanModel(prisma)) {
    const honesty = applyAdoptionReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      report: null,
      honesty,
      definitionVersion: ADOPTION_REPORT_VERSION,
    };
  }

  const reportKey = String(args.reportKey || 'overview').trim().toLowerCase();
  const total = await safeAdoptionCount(() =>
    prisma.customerAdoptionPlan.count()
  );
  if (!total.ok) {
    const honesty = applyAdoptionReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: honesty.status,
      report: null,
      honesty,
      definitionVersion: ADOPTION_REPORT_VERSION,
    };
  }

  const honesty = applyAdoptionReportHonesty({
    modelAvailable: true,
    queryOk: true,
    permissionOk: true,
  });

  return {
    ok: true,
    status:
      total.value === 0
        ? ADOPTION_REPORT_STATUS.EMPTY
        : ADOPTION_REPORT_STATUS.READY,
    report: {
      key: reportKey,
      title:
        ADOPTION_REPORT_CATALOGUE.find((r) => r.key === reportKey)?.title ||
        reportKey,
      kpis: { totalPlans: total.value },
    },
    honesty: { ...honesty, reliability: 'AVAILABLE' },
    definitionVersion: ADOPTION_REPORT_VERSION,
    domain: getAdoptionDomainContract(),
  };
}
