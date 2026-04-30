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

/**
 * Fold range-catch-all and dropdown bucket totals into `postedDirectBalance` on the canonical structure rows
 * so a second `applyCoaParentRollup` propagates them to ancestors without UI double-counting
 * (see `structureRowDisplayBalance`: folded codes omit bucket extra).
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
  // 3100 is excluded: applyCoaParentRollup zeroes direct posts on 3100 when it has DB children;
  // capital bucket (3101–3199) is applied after rollups via `apply3100CapitalBucketAncestorPropagation`.
  const codes = ['1999', '2999', '3999', '4900', '5900', '1130'];
  for (const code of codes) {
    const extra = catchAllBucketExtraForStructureCode(code, buckets);
    if (!extra) continue;
    for (const a of list) {
      const c = normAccountCode(a.accountCode || a.code);
      if (c !== code) continue;
      const pd = Number.isFinite(Number(a.postedDirectBalance))
        ? Number(a.postedDirectBalance)
        : Number(a.currentBalance) || 0;
      a.postedDirectBalance = pd + extra;
    }
  }
  return list;
}

/**
 * Owner's Capital (3100): add 3101–3199 bucket totals to the 3100 row and propagate the same delta up
 * `parentAccountId` so roots (e.g. 3000) stay reconciled. Matches prior UI intent where 3100 direct is
 * suppressed when children exist but the dropdown bucket still contributes to the structure total.
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

  const byId = new Map(list.map((a) => [a.id, a]));
  for (const a of list) {
    const c = normAccountCode(a.accountCode || a.code);
    if (c !== '3100') continue;
    a.currentBalance = (Number(a.currentBalance) || 0) + extra;
    let pid = a.parentAccountId;
    const seen = new Set();
    while (pid && byId.has(pid) && !seen.has(pid)) {
      seen.add(pid);
      const p = byId.get(pid);
      p.currentBalance = (Number(p.currentBalance) || 0) + extra;
      pid = p.parentAccountId;
    }
  }
  return list;
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
    const code = String(acc.accountCode || acc.code || '');
    const directBase = Number.isFinite(Number(acc.postedDirectBalance))
      ? Number(acc.postedDirectBalance)
      : Number(acc.currentBalance) || 0;
    const direct =
      (code === '500000' || code === '3100') && childIds.length > 0 ? 0 : directBase;
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
    a.currentBalance = rollup(a.id);
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

  if (W < 1e-9) {
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
    } else {
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
