/**
 * Accounting readiness checklist — coordination only.
 * Never posts journals / OB / stock from onboarding.
 */

import { READINESS_STATUS } from './tenant.js';
import { assertOnboardingAccountingBoundary } from '../accountingBoundary.js';

export async function evaluateAccountingReadiness(prisma, project, args = {}) {
  if (args.dimensionOverrides?.accounting) {
    return {
      status: String(args.dimensionOverrides.accounting).toUpperCase(),
      evidence: { override: true },
    };
  }

  const boundary = await assertOnboardingAccountingBoundary(prisma, {
    tenantId: project.tenantId,
    projectId: project.id,
  });

  if (!boundary.ok) {
    return {
      status: READINESS_STATUS.NOT_READY,
      evidence: { boundary, reason: 'accounting_boundary_violated' },
    };
  }

  // Checklist coordination without Tenant CoA probe → UNKNOWN (never invent READY)
  if (args.accountingChecklistComplete === true) {
    return {
      status: READINESS_STATUS.READY,
      evidence: { checklistComplete: true, boundary },
    };
  }

  return {
    status: READINESS_STATUS.UNKNOWN,
    evidence: { reason: 'accounting_checklist_not_attested', boundary },
  };
}
