// lib/branchHelpers.js
import prisma from './prisma';

/**
 * Resolve branchId from request body, session, or user's default branch
 * Priority: requestBranchId > sessionBranchId > user.defaultBranchId > null
 * @param {Object} user - User object with defaultBranchId and currentBranchId (from session)
 * @param {string|null} requestBranchId - branchId from request body (optional)
 * @param {string} tenantId - Tenant ID for validation
 * @returns {Promise<string|null>} - Validated branchId or null
 */
export async function resolveBranchId(user, requestBranchId, tenantId) {
  // Ensure requestBranchId is a string, not an object
  let branchIdToCheck = requestBranchId;
  if (branchIdToCheck && typeof branchIdToCheck !== 'string') {
    // If it's an object, try to extract the id
    if (branchIdToCheck.id && typeof branchIdToCheck.id === 'string') {
      branchIdToCheck = branchIdToCheck.id;
    } else {
      console.warn('Invalid requestBranchId type, ignoring:', typeof branchIdToCheck, branchIdToCheck);
      branchIdToCheck = null;
    }
  }
  
  // Priority 1: If branchId is provided in request, use it (highest priority)
  if (branchIdToCheck && typeof branchIdToCheck === 'string') {
    const branch = await prisma.branch.findFirst({
      where: {
        id: branchIdToCheck,
        tenantId: tenantId,
        isActive: true
      }
    });
    if (branch) {
      return branch.id;
    }
    // If provided branchId is invalid, throw error
    throw new Error('Invalid or inactive branch selected');
  }

  // Priority 2: Use branch from session (currentBranchId from cookie)
  // Ensure currentBranchId is a string
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
        isActive: true
      }
    });
    if (branch) {
      return branch.id;
    }
    // Session branch is invalid, continue to next priority
  }

  // Priority 3: Use user's default branch from database
  // Ensure defaultBranchId is a string
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
        isActive: true
      }
    });
    if (branch) {
      return branch.id;
    }
  }

  // No branch available - return null (transactions can be branch-less for backward compatibility)
  return null;
}

/**
 * Validate branchId belongs to tenant
 * @param {string} branchId - Branch ID to validate
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<boolean>} - True if valid
 */
export async function validateBranchId(branchId, tenantId) {
  if (!branchId) return true; // null is valid (backward compatibility)
  
  const branch = await prisma.branch.findFirst({
    where: {
      id: branchId,
      tenantId: tenantId,
      isActive: true
    }
  });
  return !!branch;
}

