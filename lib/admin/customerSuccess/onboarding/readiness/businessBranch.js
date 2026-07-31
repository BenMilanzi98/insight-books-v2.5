/**
 * Business / Branch readiness vs accepted scope — evaluate only.
 */

import { READINESS_STATUS } from './tenant.js';

export async function evaluateBusinessBranchReadiness(prisma, project, args = {}) {
  if (args.dimensionOverrides?.businessBranch) {
    return {
      status: String(args.dimensionOverrides.businessBranch).toUpperCase(),
      evidence: { override: true },
    };
  }

  const scope =
    args.confirmedScope ||
    project?.ownerAssignmentsJson?.confirmedScope ||
    null;

  if (!scope) {
    return {
      status: READINESS_STATUS.UNKNOWN,
      evidence: { reason: 'confirmed_scope_unavailable' },
    };
  }

  let businessCount = null;
  let branchCount = null;
  if (typeof prisma?.business?.count === 'function') {
    businessCount = await prisma.business.count({
      where: { tenantId: project.tenantId },
    });
  }
  if (typeof prisma?.branch?.count === 'function') {
    branchCount = await prisma.branch.count({
      where: { tenantId: project.tenantId },
    });
  }

  if (businessCount == null && branchCount == null) {
    return {
      status: READINESS_STATUS.UNKNOWN,
      evidence: { reason: 'business_branch_model_unavailable', expected: scope },
    };
  }

  const expectedBiz = Number(scope.businesses ?? scope.businessCount ?? 0);
  const expectedBranch = Number(scope.branches ?? scope.branchCount ?? 0);
  const ok =
    (expectedBiz <= 0 || businessCount >= expectedBiz) &&
    (expectedBranch <= 0 || branchCount >= expectedBranch);

  return {
    status: ok ? READINESS_STATUS.READY : READINESS_STATUS.NOT_READY,
    evidence: { businessCount, branchCount, expectedBiz, expectedBranch },
  };
}
