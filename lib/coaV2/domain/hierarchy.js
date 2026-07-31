/**
 * CoA V2 — account hierarchy utilities and validation (Phase 3 §10).
 *
 * Pure functions over in-memory account collections. Callers load the business-scoped
 * account set (bounded: one business's chart) and pass it in; no queries happen here,
 * which keeps hierarchy math testable and prevents N+1 lookups.
 *
 * Every rule is business-scoped: accounts from two businesses never share a hierarchy.
 */

export const DEFAULT_MAX_DEPTH = 6;

/**
 * @typedef {object} HierarchyAccount
 * @property {string} id
 * @property {string|null} [tenantId]
 * @property {string|null} [parentAccountId]
 */

/** Build an id → account index and a parent → children index. */
export function buildHierarchyIndex(accounts) {
  const byId = new Map();
  const childrenOf = new Map();
  for (const account of accounts) {
    byId.set(account.id, account);
  }
  for (const account of accounts) {
    if (account.parentAccountId == null) continue;
    if (!childrenOf.has(account.parentAccountId)) childrenOf.set(account.parentAccountId, []);
    childrenOf.get(account.parentAccountId).push(account);
  }
  return { byId, childrenOf };
}

/**
 * Ancestor chain (nearest parent first). Stops on missing parents or cycles.
 * @returns {HierarchyAccount[]}
 */
export function getAncestors(accountId, index) {
  const out = [];
  const seen = new Set([accountId]);
  let current = index.byId.get(accountId);
  while (current?.parentAccountId) {
    if (seen.has(current.parentAccountId)) break; // cycle guard
    const parent = index.byId.get(current.parentAccountId);
    if (!parent) break;
    out.push(parent);
    seen.add(parent.id);
    current = parent;
  }
  return out;
}

/**
 * All descendants (depth-first). Cycle-safe.
 * @returns {HierarchyAccount[]}
 */
export function getDescendants(accountId, index) {
  const out = [];
  const seen = new Set([accountId]);
  const stack = [...(index.childrenOf.get(accountId) ?? [])];
  while (stack.length > 0) {
    const node = stack.pop();
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    out.push(node);
    stack.push(...(index.childrenOf.get(node.id) ?? []));
  }
  return out;
}

/** Depth of an account (root = 0). */
export function getDepth(accountId, index) {
  return getAncestors(accountId, index).length;
}

/**
 * Deterministic materialized path of account codes from root to the account,
 * e.g. "1000/1100/1110". Falls back to ids when codes are missing.
 */
export function getHierarchyPath(accountId, index, codeOf = (a) => a.accountCode ?? a.code ?? a.id) {
  const account = index.byId.get(accountId);
  if (!account) return null;
  const chain = [...getAncestors(accountId, index)].reverse();
  chain.push(account);
  return chain.map(codeOf).join('/');
}

/** Root ancestor (the account itself when it has no parent). */
export function getRootAccount(accountId, index) {
  const ancestors = getAncestors(accountId, index);
  return ancestors.length > 0 ? ancestors[ancestors.length - 1] : index.byId.get(accountId) ?? null;
}

/**
 * Would setting `parentId` on `accountId` create a cycle?
 * True when the proposed parent is the account itself or one of its descendants.
 */
export function wouldCreateCycle(accountId, parentId, index) {
  if (parentId == null) return false;
  if (parentId === accountId) return true;
  return getDescendants(accountId, index).some((d) => d.id === parentId);
}

/** Detect all cycles present in a stored hierarchy (integrity scanning). */
export function findCycles(accounts) {
  const index = buildHierarchyIndex(accounts);
  const cycles = [];
  const resolved = new Set();
  for (const account of accounts) {
    if (resolved.has(account.id)) continue;
    const trail = [];
    const seen = new Map(); // id -> position in trail
    let current = account;
    while (current) {
      if (resolved.has(current.id)) break;
      if (seen.has(current.id)) {
        cycles.push(trail.slice(seen.get(current.id)).map((a) => a.id));
        break;
      }
      seen.set(current.id, trail.length);
      trail.push(current);
      current = current.parentAccountId ? index.byId.get(current.parentAccountId) : null;
    }
    for (const a of trail) resolved.add(a.id);
  }
  return cycles;
}

/**
 * Validate a parent assignment (create or move). Phase 3 §10 rules 1–8.
 *
 * @param {object} params
 * @param {{id?: string, tenantId?: string|null, category?: string|null, behaviour?: string|null, hasActivity?: boolean}} params.account
 *   the account being created/moved (id may be absent on create)
 * @param {string|null} params.parentAccountId
 * @param {HierarchyAccount[]} params.businessAccounts all accounts of the SAME business
 * @param {number} [params.maxDepth]
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateParentAssignment(params) {
  const errors = [];
  const warnings = [];
  const maxDepth = params.maxDepth ?? DEFAULT_MAX_DEPTH;
  const { account, parentAccountId } = params;

  if (parentAccountId == null) return { valid: true, errors, warnings };

  const index = buildHierarchyIndex(params.businessAccounts);
  const parent = index.byId.get(parentAccountId);

  if (!parent) {
    errors.push('Parent account not found in this business');
    return { valid: false, errors, warnings };
  }
  if (account.id && parentAccountId === account.id) {
    errors.push('An account cannot be its own parent');
  }
  if (account.tenantId != null && parent.tenantId != null && account.tenantId !== parent.tenantId) {
    errors.push('Parent account belongs to a different business');
  }
  if (account.id && wouldCreateCycle(account.id, parentAccountId, index)) {
    errors.push('Assignment would create a circular parent relationship');
  }
  if (account.category && parent.category && account.category !== parent.category) {
    errors.push(`Child category ${account.category} is incompatible with parent category ${parent.category}`);
  }
  const parentDepth = getDepth(parentAccountId, index);
  if (parentDepth + 1 > maxDepth) {
    errors.push(`Assignment exceeds the maximum hierarchy depth of ${maxDepth}`);
  }
  if (parent.behaviour === 'POSTING' && parent.allowPostingWithChildren !== true) {
    errors.push('Posting accounts cannot ordinarily have child accounts');
  }
  if (account.hasActivity) {
    warnings.push('Account has historical activity; the move requires audit and impact analysis');
  }
  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Derived balance for an account: sum of DESCENDANT POSTING balances only.
 * Header/parent stored balances are ignored so that a parent's derived total can
 * never be added to child balances again (Phase 3 §10 rules 10–11, CAP-002 fix).
 *
 * @param {string} accountId
 * @param {object} index from buildHierarchyIndex
 * @param {(account: object) => number} balanceOf leaf-balance accessor
 * @returns {number}
 */
export function deriveSubtreeBalance(accountId, index, balanceOf) {
  const children = index.childrenOf.get(accountId) ?? [];
  const self = index.byId.get(accountId);
  if (children.length === 0) {
    return self ? balanceOf(self) : 0;
  }
  // Parent with children: its own stored balance is EXCLUDED — descendants only.
  let total = 0;
  for (const child of children) {
    total += deriveSubtreeBalance(child.id, index, balanceOf);
  }
  return total;
}

/**
 * Render the hierarchy as a sorted tree (for APIs/UI). Children sorted by
 * displayOrder then code. Orphans (missing parents) surface as roots.
 */
export function buildAccountTree(accounts, { codeOf = (a) => a.accountCode ?? a.code ?? '' } = {}) {
  const index = buildHierarchyIndex(accounts);
  const sortNodes = (nodes) =>
    nodes.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || String(codeOf(a)).localeCompare(String(codeOf(b))));

  const toNode = (account, seen) => {
    if (seen.has(account.id)) return null; // cycle guard
    seen.add(account.id);
    const childAccounts = sortNodes((index.childrenOf.get(account.id) ?? []).slice());
    const children = childAccounts.map((c) => toNode(c, seen)).filter(Boolean);
    return { account, children };
  };

  const roots = accounts.filter(
    (a) => a.parentAccountId == null || !index.byId.has(a.parentAccountId)
  );
  const seen = new Set();
  return sortNodes(roots.slice()).map((r) => toNode(r, seen)).filter(Boolean);
}
