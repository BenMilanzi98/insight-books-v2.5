/**
 * Chart-of-accounts balance rollup (parent = children + direct posted) and inventory subtree alignment.
 */
import {
  accountsFor1130ExtraDropdown,
  accountsForCatchAllDropdown,
  accountsFor3100CapitalDropdown,
  catchAllBucketExtraForStructureCode,
  normAccountCode,
} from '@/lib/coaSystemStructureTree.js';
import { roundCents } from '@/lib/coaMoney.js';

const DIRECT_EPS = 1e-9;

/** Synthetic row id prefix — stable under rollup. */
export const COA_SYNTHETIC_DIRECT_PREFIX = '__coa_direct__';

export function isCoaSyntheticDirectRow(account) {
  return Boolean(account?.isSynthetic) || String(account?.id || '').startsWith(COA_SYNTHETIC_DIRECT_PREFIX);
}

/**
 * Parents with DB children and non-zero direct GL get a synthetic child row so
 * {@link applyCoaParentRollup} sums children + explicit direct without double-counting.
 * @param {Array<Record<string, unknown>>} accounts
 * @returns {Array<Record<string, unknown>>}
 */
export function injectSyntheticDirectPostingLeaves(accounts) {
  if (!Array.isArray(accounts) || accounts.length === 0) return accounts;
  const list = accounts.map((a) => ({ ...a }));
  const byId = new Map(list.map((a) => [a.id, a]));
  const childrenByParent = new Map();
  for (const a of list) {
    if (a.parentAccountId && byId.has(a.parentAccountId)) {
      if (!childrenByParent.has(a.parentAccountId)) {
        childrenByParent.set(a.parentAccountId, []);
      }
      childrenByParent.get(a.parentAccountId).push(a.id);
    }
  }

  const synth = [];
  for (const parent of list) {
    if (isCoaSyntheticDirectRow(parent)) continue;
    const childIds = childrenByParent.get(parent.id) || [];
    if (childIds.length === 0) continue;

    const directBase = Number.isFinite(Number(parent.postedDirectBalance))
      ? Number(parent.postedDirectBalance)
      : Number(parent.currentBalance) || 0;
    if (Math.abs(directBase) < DIRECT_EPS) continue;

    const code = String(parent.accountCode || parent.code || '').trim() || 'acct';
    const pid = `${COA_SYNTHETIC_DIRECT_PREFIX}${parent.id}`;
    const type = parent.accountType || parent.type || 'Asset';
    synth.push({
      id: pid,
      tenantId: parent.tenantId,
      parentAccountId: parent.id,
      accountCode: `${code}-DIRECT`,
      code: `${code}-DIRECT`,
      accountName: `Direct postings (${code})`,
      name: `Direct postings (${code})`,
      accountType: type,
      type,
      normalBalance: parent.normalBalance || null,
      isActive: true,
      isSystem: false,
      isSynthetic: true,
      mergedIntoAccountId: null,
      visibleInChart: true,
      childAccounts: [],
      postedDirectBalance: roundCents(directBase),
      currentBalance: roundCents(directBase),
      journalEntryBalance: roundCents(directBase),
      postedGlNet: roundCents(directBase),
      transactionCount: 0,
      postedEntryCount: 0,
      draftEntryCount: 0,
      additionalBalance: 0,
      balanceSource: 'synthetic_direct_postings',
    });

    parent.postedDirectBalance = 0;
    parent.journalEntryBalance = 0;
    parent.postedGlNet = 0;
  }

  return [...list, ...synth];
}

/**
 * When the canonical catch-all row (e.g. 1999) is missing from the chart list, fold bucket totals onto
 * the nearest structural ancestor that exists so parent rollups still include "Other" range accounts.
 */
const CATCH_ALL_FOLD_FALLBACK_CHAIN = {
  1999: ['1999', '1900', '1000'],
  2999: ['2999', '2500', '2000'],
  3999: ['3999', '3000'],
  4900: ['4900', '4000'],
  5900: ['5900', '5000'],
  1130: ['1130', '1100', '1000'],
};

/**
 * @param {Array<Record<string, unknown>>} list
 * @param {string[]} chain — try in order
 */
function findFirstAccountByCodeChain(list, chain) {
  for (const code of chain) {
    const row = list.find((a) => normAccountCode(a.accountCode || a.code) === code);
    if (row) return row;
  }
  return null;
}

/**
 * Fold range-catch-all and dropdown bucket totals into `postedDirectBalance` on the canonical structure rows
 * so a second `applyCoaParentRollup` propagates them to ancestors without UI double-counting
 * (see `structureRowDisplayBalance`: folded codes omit bucket extra when a row exists).
 * @param {Array<Record<string, unknown>>} accounts — list after first parent rollup (`currentBalance` set)
 */
export function foldCatchAllBucketTotalsIntoPostedDirect(accounts) {
  if (!Array.isArray(accounts) || accounts.length === 0) return accounts;
  const list = accounts.map((a) => ({ ...a }));
  const buckets = {
    h1130: accountsFor1130ExtraDropdown(list),
    c1999: accountsForCatchAllDropdown(list, '1999'),
    c2999: accountsForCatchAllDropdown(list, '2999'),
    c3999: accountsForCatchAllDropdown(list, '3999'),
    c4900: accountsForCatchAllDropdown(list, '4900'),
    c5900: accountsForCatchAllDropdown(list, '5900'),
    cap3100: accountsFor3100CapitalDropdown(list),
  };
  // 3100 capital bucket (3101–3199) is applied after rollups via `apply3100CapitalBucketAncestorPropagation`
  // (onto 3100 synthetic direct child or postedDirectBalance, or 3000 when no 3100 row).
  const codes = ['1999', '2999', '3999', '4900', '5900', '1130'];
  for (const code of codes) {
    const extra = catchAllBucketExtraForStructureCode(code, buckets);
    if (!extra || Math.abs(extra) < DIRECT_EPS) continue;
    const chain = CATCH_ALL_FOLD_FALLBACK_CHAIN[code] || [code];
    const target = findFirstAccountByCodeChain(list, chain);
    if (!target) continue;

    const directChild = list.find(
      (r) =>
        r.parentAccountId === target.id &&
        (r.isSynthetic || String(r.id || '').startsWith(COA_SYNTHETIC_DIRECT_PREFIX))
    );
    if (directChild) {
      const pd = Number.isFinite(Number(directChild.postedDirectBalance))
        ? Number(directChild.postedDirectBalance)
        : Number(directChild.currentBalance) || 0;
      directChild.postedDirectBalance = roundCents(pd + extra);
      directChild.currentBalance = directChild.postedDirectBalance;
      directChild.journalEntryBalance = directChild.postedDirectBalance;
      directChild.balanceSource = 'synthetic_direct_postings_folded_catchall';
    } else {
      const pd = Number.isFinite(Number(target.postedDirectBalance))
        ? Number(target.postedDirectBalance)
        : Number(target.currentBalance) || 0;
      target.postedDirectBalance = roundCents(pd + extra);
    }
  }
  return list;
}

/**
 * Owner's Capital (3100): add 3101–3199 bucket totals onto the 3100 survivor (synthetic direct child if any),
 * then re-run parent rollup so ancestors (e.g. 3000) stay reconciled.
 * @param {Array<Record<string, unknown>>} accounts — after second `applyCoaParentRollup`
 */
export function apply3100CapitalBucketAncestorPropagation(accounts) {
  if (!Array.isArray(accounts) || accounts.length === 0) return accounts;
  const list = accounts.map((a) => ({ ...a }));
  const buckets = {
    cap3100: accountsFor3100CapitalDropdown(list),
  };
  const extra = catchAllBucketExtraForStructureCode('3100', buckets);
  if (!extra || Math.abs(extra) < 1e-12) return list;

  const capRow = list.find((a) => normAccountCode(a.accountCode || a.code) === '3100');
  /** When no 3100 ledger row exists, fold capital bucket onto equity header 3000 (same as pre-synthetic behavior). */
  const targetRow =
    capRow || list.find((a) => normAccountCode(a.accountCode || a.code) === '3000');
  if (!targetRow) return list;

  const directChild = list.find(
    (r) => r.parentAccountId === targetRow.id && isCoaSyntheticDirectRow(r)
  );
  if (directChild) {
    const pd = Number(directChild.postedDirectBalance) || 0;
    directChild.postedDirectBalance = roundCents(pd + extra);
    directChild.currentBalance = directChild.postedDirectBalance;
    directChild.journalEntryBalance = directChild.postedDirectBalance;
  } else {
    const pd = Number(targetRow.postedDirectBalance) || 0;
    targetRow.postedDirectBalance = roundCents(pd + extra);
  }

  return applyCoaParentRollup(list);
}

/**
 * Parent rows equal sum of child balances plus balance posted directly on the parent.
 */
export function applyCoaParentRollup(accounts) {
  const list = accounts.map((a) => ({ ...a }));
  const byId = new Map(list.map((a) => [a.id, a]));
  const childrenByParent = new Map();
  for (const a of list) {
    if (a.parentAccountId && byId.has(a.parentAccountId)) {
      if (!childrenByParent.has(a.parentAccountId)) {
        childrenByParent.set(a.parentAccountId, []);
      }
      childrenByParent.get(a.parentAccountId).push(a.id);
    }
  }
  const memo = new Map();
  function rollup(id) {
    if (memo.has(id)) return memo.get(id);
    const acc = byId.get(id);
    if (!acc) return 0;
    const childIds = childrenByParent.get(id) || [];
    const directBase = Number.isFinite(Number(acc.postedDirectBalance))
      ? Number(acc.postedDirectBalance)
      : Number(acc.currentBalance) || 0;
    const direct = directBase;
    if (childIds.length === 0) {
      memo.set(id, direct);
      return direct;
    }
    const sumChildren = childIds.reduce((sum, cid) => sum + rollup(cid), 0);
    const total = direct + sumChildren;
    memo.set(id, total);
    return total;
  }
  for (const a of list) {
    a.currentBalance = roundCents(rollup(a.id));
  }
  return list;
}

/**
 * Inventory (1300) subtree aligned to Stock Management total; prefer **1310 Stock on Hand** when present as a leaf.
 */
export function applyStockLedInventoryCoaSubtree(accounts, stockTotal) {
  if (!Array.isArray(accounts) || accounts.length === 0) return accounts;
  const list = accounts.map((a) => ({ ...a }));
  const byId = new Map(list.map((a) => [a.id, a]));
  const typeAsset = (a) => {
    const t = String(a.accountType || a.type || '').trim();
    return t === 'Asset' || t === 'ASSET';
  };

  const inv = list.find((a) => String(a.accountCode || a.code || '').trim() === '1300' && typeAsset(a));
  if (!inv) return list;

  const S = Number(stockTotal) || 0;
  const childrenByParent = new Map();
  for (const a of list) {
    if (!a.parentAccountId) continue;
    if (!childrenByParent.has(a.parentAccountId)) {
      childrenByParent.set(a.parentAccountId, []);
    }
    childrenByParent.get(a.parentAccountId).push(a.id);
  }

  const subtree = new Set([inv.id]);
  const stack = [inv.id];
  while (stack.length) {
    const id = stack.pop();
    for (const k of childrenByParent.get(id) || []) {
      if (!subtree.has(k)) {
        subtree.add(k);
        stack.push(k);
      }
    }
  }

  const leafIds = [...subtree].filter((id) => {
    const kids = childrenByParent.get(id) || [];
    return !kids.some((k) => subtree.has(k));
  });

  let leaf1310Id = null;
  for (const lid of leafIds) {
    const row = byId.get(lid);
    if (!row) continue;
    if (String(row.accountCode || row.code || '').trim() === '1310' && typeAsset(row)) {
      leaf1310Id = lid;
      break;
    }
  }

  const weightSnap = new Map();
  for (const lid of leafIds) {
    if (lid === inv.id) continue;
    const row = byId.get(lid);
    if (!row) continue;
    weightSnap.set(
      lid,
      Math.abs(Number(row.postedDirectBalance ?? row.currentBalance ?? 0) || 0)
    );
  }
  const W = [...weightSnap.values()].reduce((a, b) => a + b, 0);

  const note1310 =
    'Inventory total matches Stock Management on 1310 Stock on Hand (same aggregate as Stock Management).';
  const noteParent =
    W < 1e-9
      ? 'Inventory total matches Stock Management on 1300 (no 1310 leaf; no leaf GL to split).'
      : 'Inventory total matches Stock Management; sub-accounts split this total by relative posted amounts on each leaf.';

  if (leaf1310Id != null) {
    inv.postedDirectBalance = 0;
    inv.additionalBalance = 0;
    inv.inventoryBalanceSource = 'stock_management_aggregate';
    inv.inventoryBalanceNote = note1310;
    for (const id of subtree) {
      if (id === inv.id || id === leaf1310Id) continue;
      const a = byId.get(id);
      if (!a) continue;
      a.postedDirectBalance = 0;
      a.additionalBalance = 0;
      a.inventoryBalanceSource = 'stock_management_aggregate';
      a.inventoryBalanceNote = note1310;
    }
    const s1310 = byId.get(leaf1310Id);
    if (s1310) {
      s1310.postedDirectBalance = S;
      s1310.additionalBalance = 0;
      s1310.inventoryBalanceSource = 'stock_management_aggregate';
      s1310.inventoryBalanceNote = note1310;
    }
  } else if (W < 1e-9) {
    inv.postedDirectBalance = S;
    inv.additionalBalance = 0;
    inv.inventoryBalanceSource = 'stock_management_aggregate';
    inv.inventoryBalanceNote = noteParent;
    for (const id of subtree) {
      if (id === inv.id) continue;
      const a = byId.get(id);
      if (!a) continue;
      a.postedDirectBalance = 0;
      a.additionalBalance = 0;
      a.inventoryBalanceSource = 'stock_management_aggregate';
      a.inventoryBalanceNote = noteParent;
    }
  } else {
    inv.postedDirectBalance = 0;
    inv.additionalBalance = 0;
    inv.inventoryBalanceSource = 'stock_management_aggregate';
    inv.inventoryBalanceNote = noteParent;
    for (const id of subtree) {
      if (id === inv.id) continue;
      const a = byId.get(id);
      if (!a) continue;
      if (leafIds.includes(id) && weightSnap.has(id)) {
        const w = weightSnap.get(id) || 0;
        a.postedDirectBalance = (S * w) / W;
      } else {
        a.postedDirectBalance = 0;
      }
      a.additionalBalance = 0;
      a.inventoryBalanceSource = 'stock_management_aggregate';
      a.inventoryBalanceNote = noteParent;
    }
  }

  return list;
}

/**
 * Liability register: surface outstanding principal on CoA under **2000** or the liability's `glAccountId` leaf
 * when those rows have **no** posted GL lines yet (avoids double-count vs journals).
 *
 * Call after duplicate-code merge and inventory subtree alignment, before the first `applyCoaParentRollup`.
 * @param {Array<Record<string, unknown>>} accounts — chart rows with `postedDirectBalance`, `postedEntryCount`, etc.
 * @param {Array<{ glAccountId?: string|null, currentBalance?: unknown, status?: string|null }>} liabilities
 */
export function applyLiabilityRegisterCoaSubtree(accounts, liabilities) {
  if (!Array.isArray(accounts) || accounts.length === 0) return accounts;
  const list = accounts.map((a) => ({ ...a }));
  const byId = new Map(list.map((a) => [a.id, a]));

  const typeIsLiability = (a) => {
    const t = String(a.accountType || a.type || '').trim().toUpperCase();
    return t === 'LIABILITY' || t === 'Liability';
  };

  const root2000 = list.find(
    (a) => String(a.accountCode || a.code || '').trim() === '2000' && typeIsLiability(a)
  );

  /** @type {Map<string, number>} */
  const additionsByAccountId = new Map();

  for (const liab of liabilities || []) {
    if (String(liab.status || '').toLowerCase() !== 'active') continue;
    const bal = Number(liab.currentBalance) || 0;
    if (bal <= 1e-9) continue;

    const glId = liab.glAccountId || null;
    if (glId) {
      const row = byId.get(glId);
      if (!row) continue;
      const postedCount = Number(row.postedEntryCount) || 0;
      if (postedCount > 0) continue;
      additionsByAccountId.set(glId, (additionsByAccountId.get(glId) || 0) + bal);
    } else {
      if (!root2000) continue;
      const postedCount = Number(root2000.postedEntryCount) || 0;
      if (postedCount > 0) continue;
      additionsByAccountId.set(root2000.id, (additionsByAccountId.get(root2000.id) || 0) + bal);
    }
  }

  for (const [accId, add] of additionsByAccountId) {
    const row = byId.get(accId);
    if (!row || add <= 1e-9) continue;
    const base = Number(row.postedDirectBalance ?? row.currentBalance ?? 0) || 0;
    row.postedDirectBalance = base + add;
    row.currentBalance = row.postedDirectBalance;
    row.balanceSource = 'liability_register_overlay';
    row.liabilityRegisterOverlayAmount = add;
  }

  return list;
}
