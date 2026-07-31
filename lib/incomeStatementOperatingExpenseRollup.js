/**
 * Roll operating expense amounts into SYSTEM Chart of Accounts main lines (structure file:
 * 5200, 5300, 5310, … under 5000) so the Income Statement matches the CoA instead of every
 * leaf category / custom account name.
 */

import { CHART_OF_ACCOUNTS_BLUEPRINT } from './chartOfAccountsBlueprint.js';
import { EXPENSE_ACCOUNTS_TEMPLATE } from './expenseCategoriesTemplate.js';
import { lookupStandardExpenseCodeFromCategorySync } from './expenseCategoryNormalization.js';
import { DUPLICATE_SALARY_ACCOUNT_CODE, CANONICAL_SALARY_ACCOUNT_CODE } from './salaryExpenseAccountCodes.js';

/** @type {Set<string>} */
const TEMPLATE_CODES = new Set(EXPENSE_ACCOUNTS_TEMPLATE.map((t) => t.code));

/** @type {Map<string, (typeof CHART_OF_ACCOUNTS_BLUEPRINT)[number]>} */
const BLUEPRINT_BY_CODE = new Map(CHART_OF_ACCOUNTS_BLUEPRINT.map((r) => [r.code, r]));

/**
 * Template (ensureExpenseAccountsForTenant) code → SYSTEM display code.
 * `null` = omit from operating expenses (parent / COGS template lines).
 */
const TEMPLATE_CODE_TO_SYSTEM = {
  5000: null,
  5001: null,
  5002: null,
  5003: null,
  5004: null,
  5100: null,
  5120: '5300',
  5130: '5310',
  5131: '5310',
  5132: '5310',
  5133: '5310',
  5140: '5320',
  5150: '5330',
  5160: '5900',
  5170: '5900',
  5180: '5900',
  5181: '5900',
  5182: '5900',
  5190: '5500',
  5195: '5400',
  5196: '5900',
  5197: '5340',
  5198: '5340',
  5199: '5340',
  5200: '5200',
  5201: '5200',
  5230: '5200',
  5301: '5200',
  5302: '5200',
  5210: '5900',
  5900: '5900',
  5910: '5900',
  5920: '5900',
  5930: '5900'
};

/** Standard sync codes from category text (same band as expenseCategoryNormalization mappings). */
const SYNC_STANDARD_TO_SYSTEM = {
  5001: '5320',
  5002: '5310',
  5003: '5300',
  5004: '5900',
  5005: '5900',
  5006: '5500',
  5101: '5340',
  5102: '5340',
  5103: '5340',
  5104: '5340',
  5201: '5200',
  5230: '5200',
  5302: '5200',
  5401: '5900',
  5501: '5900',
  5901: '5900'
};

const SYSTEM_OPERATING_CODES_ORDER = ['5200', '5300', '5310', '5320', '5330', '5340', '5350', '5400', '5500', '5900'];

/** Payroll / salary sub-accounts only — do not include 5210 (template = Miscellaneous; tenants may map PAYE there). */
const SALARY_CHILD_CODES = new Set(['5201', '5202', '5203', '5230', '5301']);

/**
 * @returns {{ code: string, name: string }[]}
 */
export function getSystemOperatingExpenseDisplayLines() {
  const nameBy = new Map(CHART_OF_ACCOUNTS_BLUEPRINT.map((r) => [r.code, r.name]));
  return SYSTEM_OPERATING_CODES_ORDER.map((code) => ({
    code,
    name: nameBy.get(code) || code
  }));
}

/**
 * Blueprint-only Cost of Sales subtree (5100) — omit from operating (P&L COGS is FIFO).
 * Skipped when the code is from EXPENSE_ACCOUNTS_TEMPLATE (e.g. 5120 = Rent in template).
 * @param {string} code
 */
function isBlueprintCogsSubtreeOnly(code) {
  if (TEMPLATE_CODES.has(code)) return false;
  const seen = new Set();
  let c = code;
  while (c && !seen.has(c)) {
    seen.add(c);
    if (c === '5100') {
      const row = BLUEPRINT_BY_CODE.get(code);
      return !!(row && row.type === 'Expense');
    }
    const row = BLUEPRINT_BY_CODE.get(c);
    c = row?.parentCode || null;
  }
  return false;
}

export function inferOperatingExpenseRollupCodeFromText(text) {
  return rollByName(text);
}

/**
 * @param {string} text
 * @returns {string|null}
 */
function rollByName(text) {
  const n = (text || '').toLowerCase();
  if (!n) return null;
  if (/travel|transport|accommodation|entertainment|fuel|vehicle|parking|toll/.test(n)) return '5340';
  if (/rent|lease/.test(n)) return '5300';
  if (/utilit|electric|water|internet|phone|telecom/.test(n)) return '5310';
  if (/office|stationery|supplies/.test(n)) return '5320';
  if (/market|advertis|promotion/.test(n)) return '5330';
  if (/software|subscription|hosting|saas|cloud|cursor|inmotion|it\s*(?:&|and)\s*hosting|development|developer|insightbooks|programming/.test(n)) return '5350';
  if (/voice\s*over|studio/.test(n)) return '5330';
  if (/legal|lawyer|attorney|professional\s*fee|accounting\s*fee|audit|consulting/.test(n)) return '5360';
  if (/salari|wage|payroll|paye|staff|labour|labor|employee\s*benefit/.test(n)) return '5200';
  if (/sales\s*expense|selling\s*expense/.test(n)) return '5330';
  if (/meal|refreshment|snack|food\s*allowance|entertainment/.test(n)) return '5340';
  if (/depreciat/.test(n)) return '5400';
  if (/bank\s*charge|service\s*charge/.test(n)) return '5500';
  if (/bad\s*debt/.test(n)) return '5900';
  if (/interest\s*expense|loss\s*on\s*sale|tax\s*expense/.test(n)) return '5900';
  return null;
}

/**
 * @param {{ key: string, accountCode?: string|null, accountName?: string|null }} input
 * @returns {{ rollupCode: string | null, exclude: boolean }}
 */
export function resolveOperatingExpenseRollup(input) {
  const key = input.key ?? '';
  const rawCode = (input.accountCode || '').trim();
  const name = input.accountName || '';

  if (key === 'DEP' || rawCode === 'DEP') {
    return { rollupCode: '5400', exclude: false };
  }

  if (typeof key === 'string' && key.startsWith('cat:')) {
    const rawCat = key.slice(4);
    const sync = lookupStandardExpenseCodeFromCategorySync(rawCat);
    if (sync && SYNC_STANDARD_TO_SYSTEM[sync]) {
      return { rollupCode: SYNC_STANDARD_TO_SYSTEM[sync], exclude: false };
    }
    const byCat = rollByName(rawCat);
    if (byCat) return { rollupCode: byCat, exclude: false };
    return { rollupCode: '5900', exclude: false };
  }

  if (rawCode && isBlueprintCogsSubtreeOnly(rawCode)) {
    return { rollupCode: null, exclude: true };
  }

  if (rawCode === DUPLICATE_SALARY_ACCOUNT_CODE) {
    return { rollupCode: CANONICAL_SALARY_ACCOUNT_CODE, exclude: false };
  }

  if (TEMPLATE_CODES.has(rawCode)) {
    const mapped = TEMPLATE_CODE_TO_SYSTEM[rawCode];
    if (mapped === undefined) return { rollupCode: '5900', exclude: false };
    if (mapped === null) return { rollupCode: null, exclude: true };
    return { rollupCode: mapped, exclude: false };
  }

  if (rawCode && isBlueprintCogsSubtreeOnly(rawCode)) {
    return { rollupCode: null, exclude: true };
  }

  if (rawCode && SALARY_CHILD_CODES.has(rawCode)) {
    return { rollupCode: '5200', exclude: false };
  }

  const bpRow = rawCode ? BLUEPRINT_BY_CODE.get(rawCode) : null;
  if (bpRow && bpRow.type === 'Expense' && bpRow.parentCode === '5000' && bpRow.subtype === 'Operating Expense') {
    return { rollupCode: rawCode, exclude: false };
  }

  const byName = rollByName(name) || rollByName(rawCode);
  if (byName) return { rollupCode: byName, exclude: false };

  return { rollupCode: '5900', exclude: false };
}
