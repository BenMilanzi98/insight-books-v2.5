/**
 * Chart of Accounts presentation tree — derived from `CHART_OF_ACCOUNTS_BLUEPRINT` so every
 * canonical GL code appears as its own row (not hidden in range catch-all dropdowns).
 * Tenant data is matched by `accountCode` to these nodes; non-blueprint codes go into catch-alls
 * or the Bank - Primary (1130) dropdown (1130-xx leaves only; bare 1130 is rollup-only).
 */

import { CHART_OF_ACCOUNTS_BLUEPRINT } from './chartOfAccountsBlueprint.js';
import { isCanonicalCode, isStructureExtensionCode } from './coaMigration/canonicalCodes.js';

/** @typedef {{ code: string, name: string, children?: StructureNode[] }} StructureNode */

/** @param {string} code */
export function accountTypeForStructureCode(code) {
  const r = CHART_OF_ACCOUNTS_BLUEPRINT.find((x) => x.code === code);
  return r?.type || 'Asset';
}

/** @param {typeof CHART_OF_ACCOUNTS_BLUEPRINT} [blueprint] */
export function buildStructureTreeFromBlueprint(blueprint = CHART_OF_ACCOUNTS_BLUEPRINT) {
  /** @type {Map<string, StructureNode>} */
  const nodeMap = new Map();
  for (const row of blueprint) {
    nodeMap.set(row.code, { code: row.code, name: row.name, children: [] });
  }

  /** @type {StructureNode[]} */
  const roots = [];
  for (const row of blueprint) {
    const node = nodeMap.get(row.code);
    if (!node) continue;
    if (row.parentCode && nodeMap.has(row.parentCode)) {
      nodeMap.get(row.parentCode).children.push(node);
    } else if (!row.parentCode) {
      roots.push(node);
    }
  }

  const sortByCode = (a, b) => {
    const na = parseInt(a.code, 10);
    const nb = parseInt(b.code, 10);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return a.code.localeCompare(b.code);
  };

  const sortTree = (node) => {
    if (node.children?.length) {
      node.children.sort(sortByCode);
      for (const ch of node.children) sortTree(ch);
    }
  };

  roots.sort(sortByCode);
  for (const r of roots) sortTree(r);
  return roots;
}

/** Full blueprint hierarchy — single source of truth for chart UI rows. */
export const SYSTEM_COA_STRUCTURE = buildStructureTreeFromBlueprint();

/** @param {StructureNode[]} [nodes] */
export function flattenStructureCodes(nodes = SYSTEM_COA_STRUCTURE, /** @type {Set<string>} */ out = new Set()) {
  for (const n of nodes) {
    out.add(n.code);
    if (n.children?.length) flattenStructureCodes(n.children, out);
  }
  return out;
}

export const SYSTEM_STRUCTURE_CODES = flattenStructureCodes();

/** @param {string|null|undefined} c */
export function normAccountCode(c) {
  return String(c ?? '')
    .trim()
    .replace(/\s+/g, '');
}

/**
 * @param {Array<{ accountCode?: string|null, code?: string|null }>} accounts
 * @returns {Map<string, Array<Record<string, unknown>>>}
 */
export function groupAccountsByCode(accounts) {
  /** @type {Map<string, Array<Record<string, unknown>>>} */
  const m = new Map();
  for (const a of accounts) {
    const c = normAccountCode(a.accountCode || a.code);
    if (!c) continue;
    if (!m.has(c)) m.set(c, []);
    m.get(c).push(a);
  }
  return m;
}

/** @param {string|null|undefined} s */
function normLedgerLabel(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * When several DB rows share the same GL code (multi-tenant admin view, duplicate rows, etc.), pick the row
 * whose recorded name best matches the standard chart for that code — not `matches[0]`, which made one
 * arbitrary tenant’s mislabel look like the “wrong” data for Purchases, etc.
 *
 * @param {Array<Record<string, unknown>>} matches — already filtered (e.g. active-only)
 * @param {string} structureNodeName — display name from SYSTEM_COA_STRUCTURE
 * @param {string} structureCode — GL code for blueprint lookup
 */
export function pickPrimaryAccountForStructure(matches, structureNodeName, structureCode) {
  if (!matches?.length) return null;
  const active = matches.filter((m) => m.isActive !== false);
  const pool = active.length ? active : [...matches];

  const bp = CHART_OF_ACCOUNTS_BLUEPRINT.find((x) => x.code === String(structureCode));
  const expectedLabel = (bp?.name || structureNodeName || '').trim();
  const exp = normLedgerLabel(expectedLabel);

  const meaningfulTokens = (norm) => {
    const stop = new Set(['and', 'the', 'for', 'other', 'all', 'expense', 'income', 'revenue', 'cost', 'sales']);
    return norm
      .split(/\W+/)
      .filter((w) => w.length >= 4 && !stop.has(w));
  };

  const scoreRow = (m) => {
    const ledger = normLedgerLabel(m.accountName || m.name);
    let s = 0;
    if (ledger && exp && ledger === exp) s += 1_000_000;
    else if (ledger && exp && (ledger.includes(exp) || exp.includes(ledger))) s += 200_000;
    else if (ledger && exp) {
      const lw = meaningfulTokens(ledger);
      const ew = meaningfulTokens(exp);
      const overlap = lw.filter((w) => ew.includes(w)).length;
      s += overlap * 40_000;
    }
    if (m.isSystem) s += 10_000;
    if (!m.mergedIntoAccountId) s += 5_000;
    s += Math.min(Number(m.transactionCount) || 0, 99_999);
    return s;
  };

  const sorted = [...pool].sort((a, b) => {
    const d = scoreRow(b) - scoreRow(a);
    if (d !== 0) return d;
    const ta = String(a.tenantId ?? '');
    const tb = String(b.tenantId ?? '');
    if (ta !== tb) return ta.localeCompare(tb);
    return String(a.id ?? '').localeCompare(String(b.id ?? ''));
  });
  return sorted[0] ?? null;
}

/** @param {Array<{ currentBalance?: number }>} rows */
export function sumLedgerBalances(rows) {
  return rows.reduce((s, a) => s + (Number(a.currentBalance) || 0), 0);
}

/**
 * Sum of balances for ledger rows folded into structure dropdowns (not the structure code itself).
 * @param {string} nodeCode — structure row code e.g. `5900`, `1130`, `3100`
 * @param {{ h1130?: unknown[], c1999?: unknown[], c2999?: unknown[], c3999?: unknown[], c4900?: unknown[], c5900?: unknown[], cap3100?: unknown[] }} buckets — same shape as SystemLedgerCoaTable `dropdownBuckets`
 */
export function catchAllBucketExtraForStructureCode(nodeCode, buckets = {}) {
  const c = String(nodeCode || '');
  if (c === '1130') return sumLedgerBalances(buckets.h1130 || []);
  if (c === '3100') return sumLedgerBalances(buckets.cap3100 || []);
  if (c === '1999') return sumLedgerBalances(buckets.c1999 || []);
  if (c === '2999') return sumLedgerBalances(buckets.c2999 || []);
  if (c === '3999') return sumLedgerBalances(buckets.c3999 || []);
  if (c === '4900') return sumLedgerBalances(buckets.c4900 || []);
  if (c === '5900') return sumLedgerBalances(buckets.c5900 || []);
  return 0;
}

/** Structure rows whose bucket totals are folded into API `postedDirectBalance` before rollup — UI must not add bucket extra again. */
export const COA_STRUCTURE_CODES_WITH_SERVER_FOLDED_BUCKETS = new Set([
  '1999',
  '2999',
  '3999',
  '4900',
  '5900',
  '1130',
  '3100',
]);

/**
 * Display balance for a SYSTEM structure row: same-code ledger rows + dropdown bucket (range catch-alls, 1130 extras, 3101–3199).
 * Rows in `COA_STRUCTURE_CODES_WITH_SERVER_FOLDED_BUCKETS` use API totals when a ledger row exists (bucket folded server-side);
 * when there is no row, show the bucket total so "Other" lines match the dropdown.
 * @param {Array<Record<string, unknown>>} matches — `groupAccountsByCode(accounts).get(nodeCode) || []`
 */
export function structureRowDisplayBalance(matches, nodeCode, buckets = {}) {
  const base = sumLedgerBalances(matches || []);
  const code = String(nodeCode || '');
  if (COA_STRUCTURE_CODES_WITH_SERVER_FOLDED_BUCKETS.has(code)) {
    if (matches?.length) return base;
    return catchAllBucketExtraForStructureCode(code, buckets);
  }
  return base + catchAllBucketExtraForStructureCode(nodeCode, buckets);
}

/**
 * After parent `currentBalance` rollup, add bucket totals onto structure rows whose real activity
 * lives on other GL codes (5900 / 4900 / … / 1130 / 3100). Mutates `currentBalance` in place.
 * Prefer `foldCatchAllBucketTotalsIntoPostedDirect` + second rollup on the chart API for ancestor consistency.
 * @param {Array<Record<string, unknown>>} accounts
 */
export function applyCatchAllRowDisplayBalancesToList(accounts) {
  if (!Array.isArray(accounts) || accounts.length === 0) return accounts;
  const list = accounts;
  const buckets = {
    h1130: accountsFor1130ExtraDropdown(list),
    c1999: accountsForCatchAllDropdown(list, '1999'),
    c2999: accountsForCatchAllDropdown(list, '2999'),
    c3999: accountsForCatchAllDropdown(list, '3999'),
    c4900: accountsForCatchAllDropdown(list, '4900'),
    c5900: accountsForCatchAllDropdown(list, '5900'),
    cap3100: accountsFor3100CapitalDropdown(list),
  };
  const codes = ['1999', '2999', '3999', '4900', '5900', '1130', '3100'];
  for (const code of codes) {
    const extra = catchAllBucketExtraForStructureCode(code, buckets);
    if (!extra) continue;
    for (const a of list) {
      const c = normAccountCode(a.accountCode || a.code);
      if (c !== code) continue;
      a.currentBalance = (Number(a.currentBalance) || 0) + extra;
    }
  }
  return list;
}

/**
 * Extra bank / mobile GL lines (1130-xx beyond template 01/02, plus legacy 113001-style).
 * Excludes Malawi channel child codes (1131-01, 1140-02, …) — those appear under their channel parent.
 * @param {Array<Record<string, unknown>>} accounts
 */
export function accountsFor1130ExtraDropdown(accounts) {
  const bankPrimary = accounts.find((a) => {
    const c = normAccountCode(a.accountCode || a.code);
    const t = String(a.accountType || a.type || '').toLowerCase();
    return c === '1130' && t === 'asset';
  });
  const bankPrimaryId = bankPrimary?.id ?? null;

  return accounts.filter((a) => {
    const c = normAccountCode(a.accountCode || a.code);
    if (!c) return false;
    if (/^(113[1-8]|114[01])-\d{2}$/.test(c)) return false;
    // Already rolled into **1130** via DB parent — do not fold again (would double parent totals).
    if (bankPrimaryId && a.parentAccountId === bankPrimaryId) return false;
    if (/^1130-\d{2}$/.test(c)) {
      return true;
    }
    return /^1130\d{3}$/.test(c);
  });
}

/**
 * Payment / bank channel sub-accounts (e.g. 1131-01 under National Bank 1131).
 * @param {Array<Record<string, unknown>>} accounts
 * @param {string} channelCode — 1131–1138, 1140, 1141
 */
export function accountsForPaymentChannelDropdown(accounts, channelCode) {
  const parentCode = String(channelCode || '').trim();
  if (!parentCode) return [];
  const parentRow = (accounts || []).find(
    (a) => normAccountCode(a.accountCode || a.code) === parentCode
  );
  const parentId = parentRow?.id ?? null;
  const childPrefix = `${parentCode}-`;

  return (accounts || []).filter((a) => {
    const c = normAccountCode(a.accountCode || a.code);
    if (!c) return false;
    if (c.startsWith(childPrefix) && /^\d{2}$/.test(c.slice(childPrefix.length))) return true;
    if (parentId && a.parentAccountId === parentId) return true;
    return false;
  });
}

/**
 * Tax management child GL accounts (e.g. 2041-01 under Tax Inflow, 2045-01 under Tax Outflow).
 * @param {Array<Record<string, unknown>>} accounts
 * @param {'2041'|'2045'|string} parentCode
 */
export function accountsForTaxParentDropdown(accounts, parentCode) {
  return accountsForPaymentChannelDropdown(accounts, parentCode);
}

/** @param {string|null|undefined} code */
function primaryNumericFromCode(code) {
  const m = String(code ?? '').match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : NaN;
}

/**
 * Accounts that belong in a range catch-all dropdown (not shown as separate CoA rows).
 * @param {Array<Record<string, unknown>>} accounts
 * @param {'1999'|'2999'|'4900'|'5900'|'3999'} catchCode
 */
export function accountsForCatchAllDropdown(accounts, catchCode) {
  const flat = SYSTEM_STRUCTURE_CODES;
  return accounts.filter((a) => {
    const c = normAccountCode(a.accountCode || a.code);
    if (!c || flat.has(c)) return false;
    // Blueprint leaf codes always have their own structure row — never fold into catch-alls.
    if (isCanonicalCode(c) || isStructureExtensionCode(c)) return false;
    const n = primaryNumericFromCode(c);
    const t = String(a.accountType || a.type || '').toLowerCase();

    if (catchCode === '1999') {
      if (t !== 'asset') return false;
      if (!Number.isFinite(n) || n < 1000 || n > 1999) return false;
      if (/^1130-\d{2}$/.test(c) || /^1130\d{3}$/.test(c)) return false;
      // **1100–1199**: current-asset nominal codes (1110, legacy 1111, receivable 12xx…) roll under **1100**, not Other Assets / 1999.
      if (n >= 1100 && n <= 1299) return false;
      // **1300–1399**: inventory & stock-on-hand detail — always under **1300**, never the 1900/1999 bucket.
      if (n >= 1300 && n <= 1399) return false;
      return true;
    }
    if (catchCode === '2999') {
      if (t !== 'liability') return false;
      if (/^204[15]-\d{2}$/.test(c)) return false;
      return Number.isFinite(n) && n >= 2000 && n <= 2999;
    }
    if (catchCode === '4900') {
      if (t !== 'income' && t !== 'revenue') return false;
      return Number.isFinite(n) && n >= 4000 && n <= 4999;
    }
    if (catchCode === '5900') {
      if (t !== 'expense') return false;
      if (Number.isFinite(n) && n >= 5701 && n <= 5899) return false;
      return Number.isFinite(n) && n >= 5000 && n <= 5999;
    }
    if (catchCode === '3999') {
      if (c === '500000') return true;
      if (/^\d{4}$/.test(c)) {
        const num = parseInt(c, 10);
        if (num >= 3101 && num <= 3199) return false;
      }
      if (t !== 'equity') return false;
      return Number.isFinite(n) && n >= 3000 && n <= 3999;
    }
    return false;
  });
}

/**
 * @param {StructureNode[]} nodes
 * @param {(n: StructureNode) => void} fn
 */
export function walkStructure(nodes, fn) {
  for (const n of nodes) {
    fn(n);
    if (n.children?.length) walkStructure(n.children, fn);
  }
}

/** Owner's Capital sub-accounts (3101–3199) — structure file lists only 3100; subs live in a dropdown. */
export function accountsFor3100CapitalDropdown(accounts) {
  const cap3100 = accounts.find((a) => normAccountCode(a.accountCode || a.code) === '3100');
  const cap3100Id = cap3100?.id ?? null;

  return accounts.filter((a) => {
    const c = normAccountCode(a.accountCode || a.code);
    if (!/^\d{4}$/.test(c)) return false;
    const n = parseInt(c, 10);
    if (!(n >= 3101 && n <= 3199)) return false;
    // Already rolled into 3100 via DB parent — do not fold again (would double parent totals).
    if (cap3100Id && a.parentAccountId === cap3100Id) return false;
    return true;
  });
}
