/**
 * P&L operating expense rows use each transaction's actual CoA account for amounts
 * and drill-down details — rollup rules only exclude non-operating / COGS buckets.
 */

import { CHART_OF_ACCOUNTS_BLUEPRINT } from './chartOfAccountsBlueprint.js';
import {
  lookupStandardExpenseCodeFromCategorySync,
  getStandardExpenseAccountName,
} from './expenseCategoryNormalization.js';
import { resolveOperatingExpenseRollup } from './incomeStatementOperatingExpenseRollup.js';
import {
  CANONICAL_SALARY_ACCOUNT_CODE,
  CANONICAL_SALARY_ACCOUNT_NAME,
  mapDuplicateSalaryCodeToCanonical,
} from './salaryExpenseAccountCodes.js';
import { addMoney, isNonZeroMoneyAmount, parseMoney, roundMoney } from './money.js';

/** @type {Map<string, string>} */
const BLUEPRINT_NAME_BY_CODE = new Map(
  CHART_OF_ACCOUNTS_BLUEPRINT.map((row) => [row.code, row.name])
);

/**
 * @param {{
 *   accountCode?: string|null,
 *   accountName?: string|null,
 *   accountId?: string|null,
 *   amount?: number,
 *   details?: unknown[],
 * }} bucket
 * @param {string} key
 * @param {Map<string, string>} [tenantNameByCode]
 * @param {Map<string, string>} [tenantAccountIdByCode]
 */
export function resolveOperatingExpenseStatementLine(
  bucket,
  key,
  tenantNameByCode = new Map(),
  tenantAccountIdByCode = new Map()
) {
  const accountCodeRaw =
    (bucket.accountCode && String(bucket.accountCode).trim()) ||
    (typeof key === 'string' && !String(key).startsWith('cat:') ? String(key) : '');

  const canonicalCode = mapDuplicateSalaryCodeToCanonical(accountCodeRaw) || accountCodeRaw;

  const { exclude, rollupCode } = resolveOperatingExpenseRollup({
    key: String(key),
    accountCode: canonicalCode || null,
    accountName: bucket.accountName || '',
  });
  if (exclude) return null;

  let displayCode = rollupCode || canonicalCode;
  let displayName = bucket.accountName || '';

  if (String(displayCode).startsWith('cat:') || String(key).startsWith('cat:')) {
    const rawCat = String(displayCode).startsWith('cat:')
      ? displayCode.slice(4)
      : String(key).slice(4);
    const syncCode = lookupStandardExpenseCodeFromCategorySync(rawCat);
    if (syncCode) {
      displayCode = syncCode;
      displayName =
        tenantNameByCode.get(syncCode) ||
        BLUEPRINT_NAME_BY_CODE.get(syncCode) ||
        getStandardExpenseAccountName(syncCode) ||
        rawCat;
    } else {
      displayCode = `cat:${rawCat}`;
      displayName = rawCat;
    }
  } else if (displayCode) {
    if (displayCode === CANONICAL_SALARY_ACCOUNT_CODE && !displayName) {
      displayName = CANONICAL_SALARY_ACCOUNT_NAME;
    }
    displayName =
      bucket.accountName ||
      tenantNameByCode.get(displayCode) ||
      BLUEPRINT_NAME_BY_CODE.get(displayCode) ||
      getStandardExpenseAccountName(displayCode) ||
      displayCode;
    // When rolled up to a canonical code, prefer the survivor account name.
    if (rollupCode && rollupCode !== accountCodeRaw) {
      displayName =
        tenantNameByCode.get(rollupCode) ||
        BLUEPRINT_NAME_BY_CODE.get(rollupCode) ||
        getStandardExpenseAccountName(rollupCode) ||
        displayName;
    }
  }

  let accountId = bucket.accountId ?? null;
  if (displayCode && tenantAccountIdByCode.has(displayCode)) {
    accountId = tenantAccountIdByCode.get(displayCode) ?? accountId;
  }

  return {
    accountId,
    accountCode: displayCode,
    accountName: displayName,
  };
}

/**
 * Build one P&L operating line per CoA account code (details never cross accounts).
 *
 * @param {Record<string, {
 *   accountCode?: string|null,
 *   accountName?: string|null,
 *   accountId?: string|null,
 *   amount?: number,
 *   details?: unknown[],
 * }>} amountsByAccountId
 * @param {Map<string, string>} [tenantNameByCode]
 * @param {Map<string, string>} [tenantAccountIdByCode]
 */
export function buildOperatingExpenseAccountLines(
  amountsByAccountId,
  tenantNameByCode = new Map(),
  tenantAccountIdByCode = new Map()
) {
  /** @type {Map<string, { accountId: string|null, accountCode: string, accountName: string, amount: number, details: unknown[] }>} */
  const byDisplayCode = new Map();

  for (const [key, bucket] of Object.entries(amountsByAccountId || {})) {
    const amount = parseMoney(bucket?.amount);
    if (Math.abs(amount) < 1e-6) continue;

    const resolved = resolveOperatingExpenseStatementLine(
      bucket,
      key,
      tenantNameByCode,
      tenantAccountIdByCode
    );
    if (!resolved) continue;

    const code = resolved.accountCode;
    if (!byDisplayCode.has(code)) {
      byDisplayCode.set(code, {
        accountId: resolved.accountId,
        accountCode: resolved.accountCode,
        accountName: resolved.accountName,
        amount: 0,
        details: [],
      });
    }

    const row = byDisplayCode.get(code);
    if (!row.accountId && resolved.accountId) row.accountId = resolved.accountId;
    row.amount = addMoney(row.amount, amount);
    row.details.push(...(bucket.details || []));
  }

  return filterNonZeroOperatingExpenseLines(
    Array.from(byDisplayCode.values()).map((line) => ({
      ...line,
      amount: roundMoney(line.amount),
    }))
  ).sort((a, b) => {
    const catA = String(a.accountCode).startsWith('cat:');
    const catB = String(b.accountCode).startsWith('cat:');
    if (catA !== catB) return catA ? 1 : -1;
    return String(a.accountCode).localeCompare(String(b.accountCode), undefined, {
      numeric: true,
    });
  });
}

/**
 * Omit P&L operating expense rows with no period activity (MWK 0.00).
 *
 * @param {Array<{ amount?: number, [key: string]: unknown }>} lines
 */
export function filterNonZeroOperatingExpenseLines(lines) {
  return (lines || []).filter((line) => isNonZeroMoneyAmount(line?.amount));
}
