import { classifyCoaBucketByCode } from './classifyRange.js';
import { isCanonicalCode, isStructureExtensionCode } from './canonicalCodes.js';
import { semanticMapTarget } from './semanticMap.js';

const CATCH_ALL_BY_BUCKET = {
  Asset: '1999',
  Liability: '2999',
  Revenue: '4900',
  Expense: '5900',
};

/**
 * @param {{ id: string, accountCode?: string|null, accountName?: string|null, accountType?: string|null }} account
 * @param {{ equityMigrationApproved?: boolean }} [opts]
 * @returns {{ ok: true, targetCode: string, rule: string } | { ok: false, code: string, message: string }}
 */
export function resolveAccountMigrationTarget(account, opts = {}) {
  const code = (account.accountCode || '').trim();
  const bucket = classifyCoaBucketByCode(code);

  if (bucket === 'UNCLASSIFIED') {
    return {
      ok: false,
      code: 'UNCLASSIFIED',
      message: `Account "${account.accountName || code}" has code "${code}" outside standard GL ranges.`,
    };
  }

  if (isCanonicalCode(code)) {
    return { ok: true, targetCode: code, rule: 'exact' };
  }

  if (isStructureExtensionCode(code)) {
    return { ok: true, targetCode: code, rule: 'structure_extension' };
  }

  if (code === '500000') {
    if (!opts.equityMigrationApproved) {
      return {
        ok: false,
        code: 'EQUITY_APPROVAL_REQUIRED',
        message: 'Legacy capital account 500000 requires coaEquityMigrationApproved before merging into 3100.',
      };
    }
    return { ok: true, targetCode: '3100', rule: 'merge_legacy_500000' };
  }

  if (bucket === 'Equity' && !opts.equityMigrationApproved) {
    return {
      ok: false,
      code: 'EQUITY_APPROVAL_REQUIRED',
      message: `Non-canonical equity account "${code}" requires coaEquityMigrationApproved before auto-mapping.`,
    };
  }

  const semantic = semanticMapTarget({ accountName: account.accountName, bucket });
  if (semantic) {
    return { ok: true, targetCode: semantic, rule: 'semantic' };
  }

  if (bucket === 'Equity' && opts.equityMigrationApproved) {
    return {
      ok: true,
      targetCode: '3999',
      rule: 'equity_opening_balances_suspense',
    };
  }

  const catchAll = CATCH_ALL_BY_BUCKET[bucket];
  if (!catchAll) {
    return { ok: false, code: 'NO_CATCH_ALL', message: `No catch-all for bucket ${bucket}` };
  }
  return { ok: true, targetCode: catchAll, rule: 'catch_all' };
}
