import { CHART_OF_ACCOUNTS_BLUEPRINT } from '@/lib/chartOfAccountsBlueprint';
import { classifyCoaBucketByCode } from '@/lib/coaMigration/classifyRange';
import { isCanonicalCode, isStructureExtensionCode } from '@/lib/coaMigration/canonicalCodes';

/**
 * Map API account type to classifyCoaBucketByCode bucket (Income → Revenue).
 * @param {string} accountType
 * @returns {string}
 */
function accountTypeToBucket(accountType) {
  const t = (accountType || '').trim();
  if (t === 'Income' || t === 'Revenue') return 'Revenue';
  return t;
}

/**
 * Strict CoA create rules: numeric range vs type, blueprint parent for known codes, 1130 / 3100 extensions.
 * @param {{ accountCode: string, accountType: string, parentAccount?: { accountCode?: string|null, accountType?: string|null }|null }} input
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateCoaAccountCreationRules(input) {
  const code = String(input.accountCode || '').trim();
  const bucket = classifyCoaBucketByCode(code);
  const expectedBucket = accountTypeToBucket(input.accountType);

  if (bucket === 'UNCLASSIFIED') {
    return {
      ok: false,
      message:
        'Account code must fall in a standard GL range (1000–1999 assets, 2000–2999 liabilities, 3000–3999 equity, 4000–4999 revenue, 5000–5999 expenses), or use legacy 500000 for equity.',
    };
  }

  if (bucket !== expectedBucket) {
    return {
      ok: false,
      message: `Code ${code} is in the ${bucket} range but account type is ${input.accountType}.`,
    };
  }

  const parent = input.parentAccount;
  const parentCode = parent ? String(parent.accountCode || '').trim() : '';

  if (/^1130-\d{2}$/.test(code)) {
    if (parentCode !== '1130') {
      return {
        ok: false,
        message: 'Accounts with code 1130-xx must be parented under Bank - Primary (1130).',
      };
    }
  }

  if (/^\d{4}$/.test(code)) {
    const n = parseInt(code, 10);
    if (n >= 3101 && n <= 3199) {
      if (parentCode !== '3100') {
        return {
          ok: false,
          message: "Codes 3101–3199 must be children of Owner's Capital (3100).",
        };
      }
    }
  }

  const bpRow = CHART_OF_ACCOUNTS_BLUEPRINT.find((r) => r.code === code);
  if (bpRow?.parentCode) {
    if (!parent || parentCode !== bpRow.parentCode) {
      return {
        ok: false,
        message: `For account code ${code}, parent must be blueprint account ${bpRow.parentCode}.`,
      };
    }
  }

  return { ok: true };
}
