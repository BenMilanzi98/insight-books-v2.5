/**
 * SYSTEM-structure grid balances: intermediate codes with no tenant row show the sum of visible subtree rows.
 */
import { structureRowDisplayBalance } from '@/lib/coaSystemStructureTree.js';

/**
 * @typedef {{ code: string, children?: Array<{ code: string, children?: unknown[] }> }} StructureNode
 */

/**
 * @param {StructureNode} node
 * @param {Map<string, Array<Record<string, unknown>>>} accountsByCode
 * @param {Record<string, unknown>} buckets — dropdown bucket shape for `structureRowDisplayBalance`
 * @param {boolean} activeFilter
 * @param {Map<string, { display: number, leafSelf: number, childrenSum: number }>} [memo]
 */
export function structureNodeBalanceBreakdown(
  node,
  accountsByCode,
  buckets,
  activeFilter,
  memo = new Map()
) {
  const code = String(node?.code || '');
  if (!code) {
    return { display: 0, leafSelf: 0, childrenSum: 0 };
  }
  if (memo.has(code)) {
    return memo.get(code);
  }

  const matches = (accountsByCode.get(code) || []).filter((a) =>
    activeFilter ? a.isActive !== false : true
  );
  const leafSelf = structureRowDisplayBalance(matches, code, buckets);
  const kids = node.children || [];

  let childrenSum = 0;
  for (const c of kids) {
    childrenSum += structureNodeBalanceBreakdown(c, accountsByCode, buckets, activeFilter, memo).display;
  }

  let display;
  if (kids.length === 0) {
    display = leafSelf;
  } else if (matches.length === 0) {
    display = childrenSum;
  } else {
    display = leafSelf;
  }

  const result = { display, leafSelf, childrenSum };
  memo.set(code, result);
  return result;
}
