// lib/branchHelpers.js
import prisma from './prisma';
import { clampResolvedBranchToUserAccess } from './branchAccess';

/**
 * Resolve branchId from request body, session, or user's default branch
 * Priority: requestBranchId > sessionBranchId > user.defaultBranchId > null
 * @param {Object} user - User object with defaultBranchId and currentBranchId (from session)
 * @param {string|null} requestBranchId - branchId from request body (optional)
 * @param {string} tenantId - Tenant ID for validation
 * @returns {Promise<string|null>} - Validated branchId or null
 */
export async function resolveBranchId(user, requestBranchId, tenantId) {
  let branchIdToCheck = requestBranchId;
  if (branchIdToCheck && typeof branchIdToCheck !== 'string') {
    if (branchIdToCheck.id && typeof branchIdToCheck.id === 'string') {
      branchIdToCheck = branchIdToCheck.id;
    } else {
      console.warn('Invalid requestBranchId type, ignoring:', typeof branchIdToCheck, branchIdToCheck);
      branchIdToCheck = null;
    }
  }

  let resolved = null;

  if (branchIdToCheck && typeof branchIdToCheck === 'string') {
    const branch = await prisma.branch.findFirst({
      where: {
        id: branchIdToCheck,
        tenantId: tenantId,
        isActive: true,
      },
    });
    if (!branch) {
      throw new Error('Invalid or inactive branch selected');
    }
    resolved = branch.id;
  } else {
    let currentBranchId = user?.currentBranchId;
    if (currentBranchId && typeof currentBranchId !== 'string') {
      if (currentBranchId.id && typeof currentBranchId.id === 'string') {
        currentBranchId = currentBranchId.id;
      } else {
        currentBranchId = null;
      }
    }

    if (currentBranchId && typeof currentBranchId === 'string') {
      const branch = await prisma.branch.findFirst({
        where: {
          id: currentBranchId,
          tenantId: tenantId,
          isActive: true,
        },
      });
      if (branch) {
        resolved = branch.id;
      }
    }

    if (resolved == null) {
      let defaultBranchId = user?.defaultBranchId;
      if (defaultBranchId && typeof defaultBranchId !== 'string') {
        if (defaultBranchId.id && typeof defaultBranchId.id === 'string') {
          defaultBranchId = defaultBranchId.id;
        } else {
          defaultBranchId = null;
        }
      }

      if (defaultBranchId && typeof defaultBranchId === 'string') {
        const branch = await prisma.branch.findFirst({
          where: {
            id: defaultBranchId,
            tenantId: tenantId,
            isActive: true,
          },
        });
        if (branch) {
          resolved = branch.id;
        }
      }
    }
  }

  return clampResolvedBranchToUserAccess(user, resolved);
}

/**
 * Validate branchId belongs to tenant
 * @param {string} branchId - Branch ID to validate
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<boolean>} - True if valid
 */
export async function validateBranchId(branchId, tenantId) {
  if (!branchId) return true;

  const branch = await prisma.branch.findFirst({
    where: {
      id: branchId,
      tenantId: tenantId,
      isActive: true,
    },
  });
  return !!branch;
}
