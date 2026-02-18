/**
 * Helper function to add branch filtering to dashboard queries
 * Handles backward compatibility: if branchId is null, includes both null and non-null branchId records
 * @param {Object} user - User object with currentBranchId from session
 * @param {Object} whereClause - Existing where clause to extend
 * @returns {Object} - Extended where clause with branch filtering
 */
/**
 * Normalize branch ID from session (may be string or object with id)
 */
function normalizeBranchId(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value?.id && typeof value.id === 'string') return value.id;
  return null;
}

export function addBranchFilter(user, whereClause = {}) {
  // If user has a branch selected in session, filter by it strictly
  // When "All Branches" is selected (currentBranchId is null), show all data
  const branchId = normalizeBranchId(user?.currentBranchId);
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
  const branchId = normalizeBranchId(user?.currentBranchId);
  if (branchId) {
    whereClause.branchId = branchId;
  }
  return whereClause;
}

