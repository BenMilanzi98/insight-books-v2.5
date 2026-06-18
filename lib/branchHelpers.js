// lib/branchHelpers.js
import prisma from './prisma';
import { resolveHiddenPrimaryBranchId } from './hiddenPrimaryBranch';

/**
 * Resolve branchId for writes — always the tenant's hidden primary branch.
 * Request body and session branch selections are ignored.
 */
export async function resolveBranchId(user, _requestBranchId, tenantId) {
  const effectiveTenantId = tenantId || user?.tenantId;
  if (!effectiveTenantId) return null;
  return resolveHiddenPrimaryBranchId(effectiveTenantId);
}

/**
 * Validate branchId belongs to tenant (legacy callers).
 */
export async function validateBranchId(branchId, tenantId) {
  if (!branchId) return true;
  const primary = await resolveHiddenPrimaryBranchId(tenantId);
  return branchId === primary;
}
