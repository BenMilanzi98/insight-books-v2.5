/**
 * Helper function to add branch filtering to dashboard queries
 * Handles backward compatibility: if branchId is null, includes both null and non-null branchId records
 * @param {Object} user - User object with currentBranchId from session
 * @param {Object} whereClause - Existing where clause to extend
 * @returns {Object} - Extended where clause with branch filtering
 */
import { getEffectiveDashboardBranchId } from './branchAccess';

export function addBranchFilter(user, whereClause = {}) {
  const branchId = getEffectiveDashboardBranchId(user);
  if (branchId === false) {
    const noAccess = { branchId: { in: [] } };
    if (whereClause.OR) {
      const existingOR = Array.isArray(whereClause.OR) ? whereClause.OR : [whereClause.OR];
      whereClause.AND = [{ OR: existingOR }, noAccess];
      delete whereClause.OR;
    } else if (whereClause.AND) {
      whereClause.AND.push(noAccess);
    } else {
      Object.assign(whereClause, noAccess);
    }
    return whereClause;
  }
  // Full access: null session = all branches; restricted users always resolve to an allowed branch.
  if (branchId) {
    // When a branch is selected, show ONLY records with that branchId
    // This ensures branch isolation - each branch sees only its own data
    
    // Handle existing OR clause - merge with branch filter using AND
    if (whereClause.OR) {
      // If there's already an OR, we need to combine it with branch filter
      // Create a new structure: (existing OR conditions) AND (branch filter)
      const existingOR = Array.isArray(whereClause.OR) ? whereClause.OR : [whereClause.OR];
      const branchFilter = {
        branchId
      };
      
      // Combine using AND: (existing conditions) AND (branch filter)
      whereClause.AND = [
        { OR: existingOR },
        branchFilter
      ];
      delete whereClause.OR; // Remove old OR, now in AND
    } else if (whereClause.AND) {
      // If there's already an AND, append branch filter to it
      whereClause.AND.push({ branchId });
    } else {
      // No existing OR or AND, just add branch filter
      whereClause.branchId = branchId;
    }
  }
  // If no branch selected (currentBranchId is null), show all data
  // This allows viewing consolidated data across all branches
  
  return whereClause;
}

/**
 * Alternative: Strict branch filtering (only show selected branch, exclude null)
 * Use this when you want strict branch isolation
 */
export function addStrictBranchFilter(user, whereClause = {}) {
  const branchId = getEffectiveDashboardBranchId(user);
  if (branchId === false) {
    whereClause.branchId = { in: [] };
    return whereClause;
  }
  if (branchId) {
    whereClause.branchId = branchId;
  }
  return whereClause;
}

/**
 * Branch filter for Expense (and similar) models where unassigned (null branchId)
 * records should still appear in reports when a branch is selected.
 * E.g. supplier/PO-created expenses often have no branch; they should count in
 * expense summary and staff allocation views.
 * When branch is selected: show (branchId = X OR branchId = null).
 */
export function addBranchFilterIncludeUnassigned(user, whereClause = {}) {
  const branchId = getEffectiveDashboardBranchId(user);
  if (branchId === false) {
    const noAccess = { branchId: { in: [] } };
    if (whereClause.AND) {
      whereClause.AND.push(noAccess);
    } else {
      Object.assign(whereClause, noAccess);
    }
    return whereClause;
  }
  if (branchId) {
    const branchOrUnassigned = { OR: [{ branchId }, { branchId: null }] };
    if (whereClause.OR) {
      const existingOR = Array.isArray(whereClause.OR) ? whereClause.OR : [whereClause.OR];
      whereClause.AND = [{ OR: existingOR }, branchOrUnassigned];
      delete whereClause.OR;
    } else if (whereClause.AND) {
      whereClause.AND.push(branchOrUnassigned);
    } else {
      Object.assign(whereClause, branchOrUnassigned);
    }
  }
  return whereClause;
}

