/**
 * Custom tenant expense GL codes under structure header **5700** (5701–5899).
 * Pure helpers — safe for client and server bundles.
 */

export const CUSTOM_EXPENSE_HEADER_CODE = '5700';
export const CUSTOM_EXPENSE_CODE_MIN = 5701;
export const CUSTOM_EXPENSE_CODE_MAX = 5899;

/** @param {string} code */
export function isCustomExpenseLeafCode(code) {
  const c = String(code ?? '').trim();
  if (!/^\d{4}$/.test(c)) return false;
  const n = parseInt(c, 10);
  return n >= CUSTOM_EXPENSE_CODE_MIN && n <= CUSTOM_EXPENSE_CODE_MAX;
}

/**
 * @param {Array<{ accountCode?: string|null, code?: string|null }>} accounts
 * @returns {string} parent account id or ''
 */
export function findCustomExpensesParentId(accounts) {
  const row = (accounts || []).find(
    (a) => String(a.accountCode || a.code || '').trim() === CUSTOM_EXPENSE_HEADER_CODE
  );
  return row?.id ? String(row.id) : '';
}

/**
 * Collect 4-digit codes in 5701–5899 from chart account rows.
 * @param {Array<{ accountCode?: string|null, code?: string|null }>} accounts
 * @returns {Set<string>}
 */
export function collectUsedCustomExpenseCodes(accounts) {
  const used = new Set();
  for (const a of accounts || []) {
    const c = String(a.accountCode || a.code || '').trim();
    if (!/^\d{4}$/.test(c)) continue;
    const n = parseInt(c, 10);
    if (n >= CUSTOM_EXPENSE_CODE_MIN && n <= CUSTOM_EXPENSE_CODE_MAX) used.add(c);
  }
  return used;
}

/**
 * @param {Iterable<string>} usedCodes
 * @returns {string|null}
 */
export function computeNextCustomExpenseCode(usedCodes) {
  const used = usedCodes instanceof Set ? usedCodes : new Set(usedCodes);
  for (let n = CUSTOM_EXPENSE_CODE_MIN; n <= CUSTOM_EXPENSE_CODE_MAX; n++) {
    const c = String(n);
    if (!used.has(c)) return c;
  }
  return null;
}

/**
 * UI hint for the Add Account modal (server assigns on save).
 * @param {Array<{ accountCode?: string|null, code?: string|null }>} accounts
 */
export function nextCustomExpenseCodeHint(accounts) {
  const next = computeNextCustomExpenseCode(collectUsedCustomExpenseCodes(accounts));
  if (next) return `Next available: ${next} (assigned automatically on save)`;
  return 'All codes 5701–5899 are in use';
}
