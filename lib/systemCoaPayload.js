/**
 * System-wide Chart of Accounts definition (admin JSON) + validation.
 * Applied to every tenant via lib/applySystemCoaToAllTenants.js
 */

import { CHART_OF_ACCOUNTS_BLUEPRINT } from './chartOfAccountsBlueprint.js';

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];

export function normalizeAccountType(value) {
  if (!value) return 'Asset';
  const normalized = String(value).trim();
  const upper = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  return ACCOUNT_TYPES.includes(upper) ? upper : upper;
}

export function buildDefaultSystemCoaPayload() {
  return {
    version: 1,
    accounts: CHART_OF_ACCOUNTS_BLUEPRINT.map((row) => ({
      code: row.code,
      name: row.name,
      type: row.type,
      subtype: row.subtype || null,
      normalBalance: row.normalBalance || null,
      parentCode: row.parentCode || null,
      isSystem: Boolean(row.isSystem),
      description: row.description || null,
      ...(row.requiresReclassification ? { requiresReclassification: true } : {}),
    })),
    merges: [],
    deactivatedCodes: [],
  };
}

/** Topological order: parents before children (only edges where both ends are in the payload). */
export function sortAccountsForApply(accounts) {
  const codes = new Set(accounts.map((a) => a.code));
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  const indegree = new Map();
  const children = new Map();
  for (const a of accounts) {
    indegree.set(a.code, 0);
    children.set(a.code, []);
  }
  for (const a of accounts) {
    const p = a.parentCode;
    if (p && codes.has(p)) {
      indegree.set(a.code, (indegree.get(a.code) || 0) + 1);
      children.get(p).push(a.code);
    }
  }
  const queue = [...codes].filter((c) => indegree.get(c) === 0);
  queue.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const out = [];
  while (queue.length) {
    const c = queue.shift();
    out.push(byCode.get(c));
    const chs = [...(children.get(c) || [])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    for (const ch of chs) {
      indegree.set(ch, indegree.get(ch) - 1);
      if (indegree.get(ch) === 0) queue.push(ch);
    }
    queue.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }
  if (out.length !== accounts.length) {
    return [...accounts].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }
  return out;
}

/**
 * @param {unknown} payload
 * @returns {{ ok: true, payload: object } | { ok: false, error: string }}
 */
/**
 * Load the admin-saved system CoA from the DB when present and valid.
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 * @returns {Promise<object|null>}
 */
export async function loadValidatedSystemCoaPayload(db) {
  if (!db) return null;
  try {
    const row = await db.systemCoaDefinition.findUnique({
      where: { id: 'default' },
      select: { payload: true },
    });
    if (!row?.payload || typeof row.payload !== 'object') return null;
    const validated = validateSystemCoaPayload(row.payload);
    return validated.ok ? validated.payload : null;
  } catch (e) {
    console.warn('loadValidatedSystemCoaPayload:', e?.message || e);
    return null;
  }
}

export function validateSystemCoaPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Payload must be an object' };
  }
  const accounts = payload.accounts;
  if (!Array.isArray(accounts) || accounts.length === 0) {
    return { ok: false, error: 'accounts[] is required and must be non-empty' };
  }
  const codes = new Set();
  for (const row of accounts) {
    if (!row || typeof row.code !== 'string' || !row.code.trim()) {
      return { ok: false, error: 'Each account must have a non-empty code' };
    }
    if (codes.has(row.code)) {
      return { ok: false, error: `Duplicate account code: ${row.code}` };
    }
    codes.add(row.code);
    if (!row.name || typeof row.name !== 'string') {
      return { ok: false, error: `Account ${row.code}: name is required` };
    }
    if (row.parentCode != null && row.parentCode !== '') {
      if (!codes.has(row.parentCode)) {
        return { ok: false, error: `Account ${row.code}: parentCode ${row.parentCode} is not in accounts[]` };
      }
    }
  }

  const merges = Array.isArray(payload.merges) ? payload.merges : [];
  const mergeSources = new Set();
  for (const m of merges) {
    if (!m || typeof m.sourceCode !== 'string' || typeof m.targetCode !== 'string') {
      return { ok: false, error: 'Each merge needs sourceCode and targetCode strings' };
    }
    if (m.sourceCode === m.targetCode) {
      return { ok: false, error: `Invalid merge: ${m.sourceCode} cannot merge into itself` };
    }
    if (!codes.has(m.sourceCode) || !codes.has(m.targetCode)) {
      return { ok: false, error: `Merge ${m.sourceCode} → ${m.targetCode}: both codes must exist in accounts[]` };
    }
    if (mergeSources.has(m.sourceCode)) {
      return { ok: false, error: `Account ${m.sourceCode} cannot be the source of more than one merge` };
    }
    mergeSources.add(m.sourceCode);
  }
  const mergeTargets = new Set(merges.map((m) => m.targetCode));
  for (const t of mergeTargets) {
    if (mergeSources.has(t)) {
      return { ok: false, error: `Account ${t} cannot be both a merge target and a merge source (no merge chains)` };
    }
  }

  const deactivated = Array.isArray(payload.deactivatedCodes) ? payload.deactivatedCodes : [];
  for (const code of deactivated) {
    if (typeof code !== 'string' || !codes.has(code)) {
      return { ok: false, error: `deactivatedCodes: unknown code ${code}` };
    }
    const row = accounts.find((a) => a.code === code);
    if (row?.isSystem) {
      return { ok: false, error: `Cannot deactivate system account ${code}` };
    }
    if (mergeSources.has(code)) {
      return { ok: false, error: `Cannot deactivate merged source ${code}; remove the merge first` };
    }
  }

  for (const m of merges) {
    if (deactivated.includes(m.targetCode)) {
      return { ok: false, error: `Cannot merge into deactivated account ${m.targetCode}` };
    }
  }

  return { ok: true, payload: { ...payload, version: Number(payload.version) || 1, accounts, merges, deactivatedCodes: deactivated } };
}
