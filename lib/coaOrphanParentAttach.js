/**
 * Reattach `parentAccountId` on in-chart rows whose DB parent is missing from the working list
 * (inactive, chart-hidden, merged-out, etc.) so `applyCoaParentRollup` includes them under the nearest ancestor present.
 *
 * @param {Array<Record<string, unknown>>} accounts — merged chart rows (after duplicate-code merge)
 * @param {Map<string, string|null|undefined>} parentAccountIdByAccountId — tenant-wide id → parentAccountId from DB
 * @returns {Array<Record<string, unknown>>} shallow copies with adjusted parents where needed
 */
export function reattachOrphanParentsForCoaRollup(accounts, parentAccountIdByAccountId) {
  if (!Array.isArray(accounts) || accounts.length === 0) return accounts;
  if (!(parentAccountIdByAccountId instanceof Map) || parentAccountIdByAccountId.size === 0) {
    return accounts;
  }

  const idSet = new Set(accounts.map((a) => a.id));

  return accounts.map((row) => {
    let pid = row.parentAccountId;
    if (!pid || idSet.has(pid)) {
      return row;
    }

    const seen = new Set();
    let walker = pid;
    while (walker && !seen.has(walker)) {
      seen.add(walker);
      if (idSet.has(walker)) {
        return row.parentAccountId === walker ? row : { ...row, parentAccountId: walker };
      }
      walker = parentAccountIdByAccountId.get(walker) ?? null;
    }

    return row;
  });
}
