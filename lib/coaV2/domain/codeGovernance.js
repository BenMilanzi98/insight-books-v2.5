/**
 * CoA V2 — account-code governance (Phase 3 §11).
 *
 * InsightBooks already has an approved code standard (the canonical blueprint,
 * `lib/chartOfAccountsBlueprint.js`): five roots 1000/2000/3000/4000/5000 with
 * Cost of Sales under 5100 and bank/payment children using `NNNN-NN` suffixes.
 * This module encodes THAT standard — it does not impose the generic 6000/7000
 * split, because the approved structure keeps Cost of Sales inside the 5xxx range.
 *
 * Approved anchors preserved verbatim:
 *   5000 — Expenses (header)
 *   5100 — Cost of Sales (group under 5000)
 *   5200 — Salaries & Wages (canonical posting account)
 */

import { AccountCategory } from '../../accountingV2/domain/enums.js';

/** Approved anchors that governance must preserve. */
export const APPROVED_CODE_ANCHORS = Object.freeze({
  EXPENSES_HEADER: '5000',
  COST_OF_SALES_GROUP: '5100',
  SALARIES_AND_WAGES: '5200',
});

/**
 * Permitted code formats:
 *  - primary: 4 digits ("1110")
 *  - payment/bank child: 4 digits + "-" + 2 digits ("1131-01")
 *  - tax child: 4 digits + "-" + 2 digits ("2041-01")
 */
export const ACCOUNT_CODE_PATTERN = /^\d{4}(-\d{2})?$/;

/** Category ranges under the approved InsightBooks standard. */
export const CATEGORY_CODE_RANGES = Object.freeze({
  [AccountCategory.ASSET]: [{ from: 1000, to: 1999 }],
  [AccountCategory.LIABILITY]: [{ from: 2000, to: 2999 }],
  [AccountCategory.EQUITY]: [{ from: 3000, to: 3999 }],
  [AccountCategory.REVENUE]: [{ from: 4000, to: 4899 }],
  [AccountCategory.OTHER_INCOME]: [{ from: 4900, to: 4999 }, { from: 7000, to: 7499 }],
  [AccountCategory.COST_OF_SALES]: [{ from: 5100, to: 5199 }, { from: 6000, to: 6999 }],
  [AccountCategory.EXPENSE]: [{ from: 5000, to: 5999 }],
  [AccountCategory.OTHER_EXPENSE]: [{ from: 7500, to: 7999 }],
});

/** Normalize a raw code: trim, strip internal whitespace, uppercase. */
export function normalizeAccountCode(raw) {
  if (raw == null) return null;
  return String(raw).trim().replace(/\s+/g, '').toUpperCase();
}

/** Numeric prefix of a (normalized) code, or null. */
export function codeNumericPrefix(code) {
  const m = /^(\d{4})/.exec(String(code ?? ''));
  return m ? Number(m[1]) : null;
}

/**
 * Validate an account code's format and (optionally) its category range.
 * Range violations are WARNINGS, not errors: legacy tenants have out-of-range
 * codes with history, and explicit FS mappings — not code ranges — control
 * reporting (Phase 3 §24).
 *
 * @param {object} params
 * @param {string} params.code raw code
 * @param {string} [params.category] AccountCategory value
 * @returns {{ valid: boolean, normalized: string|null, errors: string[], warnings: string[] }}
 */
export function validateAccountCode({ code, category = null }) {
  const errors = [];
  const warnings = [];
  const normalized = normalizeAccountCode(code);
  if (!normalized) {
    errors.push('Account code is required');
    return { valid: false, normalized: null, errors, warnings };
  }
  if (!ACCOUNT_CODE_PATTERN.test(normalized)) {
    errors.push(`Account code "${normalized}" is not a permitted format (NNNN or NNNN-NN)`);
    return { valid: false, normalized, errors, warnings };
  }
  if (category && CATEGORY_CODE_RANGES[category]) {
    const prefix = codeNumericPrefix(normalized);
    const inRange = CATEGORY_CODE_RANGES[category].some((r) => prefix >= r.from && prefix <= r.to);
    if (!inRange) {
      warnings.push(`Code ${normalized} is outside the recommended range for ${category}`);
    }
  }
  return { valid: errors.length === 0, normalized, errors, warnings };
}

/** Sortable key so "1131-01" orders after "1131" and before "1132". */
export function accountCodeSortKey(code) {
  const normalized = normalizeAccountCode(code) ?? '';
  const [main, suffix] = normalized.split('-');
  return `${main.padStart(6, '0')}-${(suffix ?? '00').padStart(4, '0')}`;
}

/**
 * Account-code change control (Phase 3 §11): codes with historical use are
 * immutable outside the controlled process.
 *
 * @param {object} params
 * @param {string} params.currentCode
 * @param {string} params.newCode
 * @param {boolean} params.hasHistoricalActivity journal/transaction lines exist
 * @param {object} [params.controlled] the controlled-process evidence
 * @param {string} [params.controlled.reason]
 * @param {boolean} [params.controlled.impactAnalysisDone]
 * @param {boolean} [params.controlled.aliasWillBeCreated]
 * @param {boolean} [params.controlled.authorized] caller holds coa.update + elevated permission
 * @returns {{ allowed: boolean, errors: string[] }}
 */
export function validateAccountCodeChange(params) {
  const errors = [];
  const current = normalizeAccountCode(params.currentCode);
  const next = normalizeAccountCode(params.newCode);
  if (current === next) return { allowed: true, errors };

  const format = validateAccountCode({ code: next });
  if (!format.valid) errors.push(...format.errors);

  if (Object.values(APPROVED_CODE_ANCHORS).includes(current)) {
    errors.push(`Code ${current} is an approved system anchor and cannot be changed`);
  }
  if (params.hasHistoricalActivity) {
    const c = params.controlled ?? {};
    if (!c.authorized) errors.push('Changing a historically used account code requires elevated authorization');
    if (!c.reason) errors.push('Changing a historically used account code requires a documented reason');
    if (!c.impactAnalysisDone) errors.push('Changing a historically used account code requires an impact analysis');
    if (!c.aliasWillBeCreated) errors.push('Changing a historically used account code requires preserving the old code as an alias');
  }
  return { allowed: errors.length === 0, errors };
}

/**
 * Next free code inside a range for a business (used by templates/custom accounts).
 * @param {string[]} existingCodes normalized codes already in use
 * @param {{from: number, to: number}} range
 * @param {number} [step]
 * @returns {string|null} null when the range is exhausted
 */
export function nextAvailableCode(existingCodes, range, step = 10) {
  const used = new Set(existingCodes.map((c) => codeNumericPrefix(c)).filter((n) => n != null));
  for (let candidate = range.from; candidate <= range.to; candidate += step) {
    if (!used.has(candidate)) return String(candidate);
  }
  for (let candidate = range.from; candidate <= range.to; candidate += 1) {
    if (!used.has(candidate)) return String(candidate);
  }
  return null;
}
