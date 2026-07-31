/**
 * Onboarding report catalogue — Phase 17 Wave 4.
 * Subset: Overview, At-Risk, Overdue Customer Tasks, Go-Live Readiness, Completion.
 */

import {
  canViewOnboarding,
  hasCustomerOnboardingProjectModel,
  resolveOnboardingActor,
} from './model.js';
import { getOnboardingDomainContract } from './catalogue.js';
import {
  applyOnboardingReportHonesty,
  safeOnboardingCount,
  ONBOARDING_REPORT_STATUS,
} from './reliabilityGate.js';

export const ONBOARDING_REPORT_VERSION = 'cs-onboarding-report-v1-2026-07-31';

export const ONBOARDING_REPORT_CATALOGUE = Object.freeze([
  { key: 'overview', title: 'Onboarding Overview' },
  { key: 'at-risk', title: 'At-Risk Onboarding' },
  { key: 'overdue-customer-tasks', title: 'Overdue Customer Tasks' },
  { key: 'go-live-readiness', title: 'Go-Live Readiness' },
  { key: 'completion', title: 'Onboarding Completion' },
]);

export function listOnboardingReports() {
  return ONBOARDING_REPORT_CATALOGUE.map((r) => ({ ...r }));
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, reportKey?: string }} args
 */
export async function getOnboardingReport(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canViewOnboarding(admin)) {
    const honesty = applyOnboardingReportHonesty({ permissionOk: false });
    return {
      ok: false,
      forbidden: true,
      status: honesty.status,
      report: null,
      honesty,
    };
  }

  if (!hasCustomerOnboardingProjectModel(prisma)) {
    const honesty = applyOnboardingReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      report: null,
      honesty,
      definitionVersion: ONBOARDING_REPORT_VERSION,
    };
  }

  const reportKey = String(args.reportKey || 'overview').trim().toLowerCase();
  const total = await safeOnboardingCount(() =>
    prisma.customerOnboardingProject.count()
  );
  if (!total.ok) {
    const honesty = applyOnboardingReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: honesty.status,
      report: null,
      honesty,
      definitionVersion: ONBOARDING_REPORT_VERSION,
    };
  }

  const honesty = applyOnboardingReportHonesty({
    modelAvailable: true,
    queryOk: true,
    permissionOk: true,
  });

  return {
    ok: true,
    status:
      total.value === 0
        ? ONBOARDING_REPORT_STATUS.EMPTY
        : ONBOARDING_REPORT_STATUS.READY,
    report: {
      key: reportKey,
      title:
        ONBOARDING_REPORT_CATALOGUE.find((r) => r.key === reportKey)?.title ||
        reportKey,
      kpis: { totalProjects: total.value },
    },
    honesty: { ...honesty, reliability: 'AVAILABLE' },
    definitionVersion: ONBOARDING_REPORT_VERSION,
    domain: getOnboardingDomainContract(),
  };
}
