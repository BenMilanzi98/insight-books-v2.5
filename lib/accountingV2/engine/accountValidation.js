/**
 * Posting engine — per-line account validation (Phase 4).
 *
 * Every journal line is validated against the Phase 3 account classification:
 * existence, business ownership, lifecycle, posting behaviour, header exclusion,
 * category compatibility, currency policy, control-account dimensions, and manual
 * posting restrictions. No name/code/fallback resolution ever happens here.
 */

import { assertSameBusiness } from '../domain/accountingContext.js';
import {
  AccountNotFoundError,
  CrossTenantAccountingError,
  InactiveAccountError,
  DeprecatedAccountError,
  NonPostingAccountError,
  ControlAccountDimensionError,
  InvalidCurrencyError,
  InvalidJournalLineError,
  ApprovalInvalidError,
} from '../domain/errors.js';
import { AccountBehaviour } from '../domain/enums.js';
import {
  AccountLifecycleStatus,
  AccountCurrencyPolicy,
  behaviourAcceptsPostings,
  behaviourAcceptsManualPostings,
} from '../../coaV2/domain/behaviours.js';
import { ACCOUNTING_PERMISSIONS } from '../permissions.js';

/** Control-account purposes (`Account.controlAccountPurpose`) → required line dimension. */
export const CONTROL_DIMENSION_REQUIREMENTS = Object.freeze({
  ACCOUNTS_RECEIVABLE: 'customerId',
  ACCOUNTS_PAYABLE: 'supplierId',
});

/** System purposes that manual journals may not touch under ordinary workflow. */
export const MANUAL_RESTRICTED_PURPOSES = Object.freeze([
  'CURRENT_YEAR_EARNINGS',
  'RETAINED_EARNINGS',
  'OPENING_BALANCE_EQUITY',
  'SUSPENSE_ACCOUNT',
]);

/**
 * Load all referenced accounts business-scoped, with the fields validation needs.
 * @param {import('@prisma/client').Prisma.TransactionClient|import('@prisma/client').PrismaClient} db
 * @param {import('../domain/accountingContext.js').AccountingContext} context
 * @param {string[]} accountIds
 * @returns {Promise<Map<string, object>>}
 */
export async function loadAccountsForValidation(db, context, accountIds) {
  const unique = [...new Set(accountIds)];
  const rows = await db.account.findMany({
    where: { id: { in: unique }, tenantId: context.businessId },
    select: {
      id: true,
      tenantId: true,
      accountCode: true,
      code: true,
      accountName: true,
      name: true,
      isActive: true,
      acceptsNewTransactions: true,
      coaV2Category: true,
      coaV2Behaviour: true,
      coaV2NormalBalance: true,
      coaV2Status: true,
      postingAllowed: true,
      manualPostingAllowed: true,
      currencyPolicy: true,
      specificCurrency: true,
      systemPurpose: true,
      controlAccountPurpose: true,
      coaEffectiveFrom: true,
      coaEffectiveTo: true,
      _count: { select: { childAccounts: { where: { isActive: true } } } },
    },
  });
  const map = new Map(rows.map((r) => [r.id, r]));
  return map;
}

/**
 * Validate one journal line against its loaded account.
 *
 * @param {object} params
 * @param {import('../domain/accountingContext.js').AccountingContext} params.context
 * @param {object|undefined} params.account loaded account row (undefined = not found in business)
 * @param {import('../domain/journalDraft.js').JournalLineDraft} params.line
 * @param {string} params.currency journal transaction currency
 * @param {string} params.baseCurrency
 * @param {boolean} params.isManual manual/adjustment journal (stricter restrictions)
 * @param {(permission: string) => boolean} params.hasPermission
 * @param {string|Date} params.postingDate
 */
export function validateLineAccount(params) {
  const { context, account, line, isManual, hasPermission, postingDate } = params;
  const ids = { requestId: context.requestId, correlationId: context.correlationId };

  if (!account) {
    throw new AccountNotFoundError({ ...ids, diagnostic: { accountId: line.accountId } });
  }
  // Defense in depth — loadAccountsForValidation is already tenant-scoped.
  if (account.tenantId !== context.businessId) {
    throw new CrossTenantAccountingError({ ...ids, diagnostic: { accountId: account.id } });
  }

  const ref = { accountId: account.id, code: account.accountCode ?? account.code };

  if (account.isActive === false) {
    throw new InactiveAccountError(ref, ids);
  }
  if (account.coaV2Status === AccountLifecycleStatus.DEPRECATED) {
    throw new DeprecatedAccountError(ref, ids);
  }
  if (account.coaV2Status === AccountLifecycleStatus.ARCHIVED) {
    throw new InactiveAccountError(ref, ids);
  }
  if (account.acceptsNewTransactions === false || account.postingAllowed === false) {
    throw new NonPostingAccountError(ref, ids);
  }
  // Header accounts never receive postings — behaviour flag or active children.
  if (account.coaV2Behaviour === AccountBehaviour.HEADER || (account._count?.childAccounts ?? 0) > 0) {
    throw new NonPostingAccountError(ref, ids);
  }
  if (account.coaV2Behaviour && !behaviourAcceptsPostings(account.coaV2Behaviour)) {
    throw new NonPostingAccountError(ref, ids);
  }

  // Effective window.
  const at = new Date(postingDate).getTime();
  if (account.coaEffectiveFrom && at < new Date(account.coaEffectiveFrom).getTime()) {
    throw new NonPostingAccountError(ref, { ...ids, diagnostic: { reason: 'before effectiveFrom' } });
  }
  if (account.coaEffectiveTo && at > new Date(account.coaEffectiveTo).getTime()) {
    throw new NonPostingAccountError(ref, { ...ids, diagnostic: { reason: 'after effectiveTo' } });
  }

  // Currency policy.
  const lineCurrency = line.debit?.currency ?? line.credit?.currency ?? params.currency;
  if (account.currencyPolicy === AccountCurrencyPolicy.SPECIFIC_CURRENCY &&
      account.specificCurrency && lineCurrency !== account.specificCurrency) {
    throw new InvalidCurrencyError(lineCurrency, {
      ...ids,
      diagnostic: { accountId: account.id, requires: account.specificCurrency },
    });
  }
  if (account.currencyPolicy === AccountCurrencyPolicy.BASE_CURRENCY_ONLY &&
      lineCurrency !== params.baseCurrency) {
    throw new InvalidCurrencyError(lineCurrency, {
      ...ids,
      diagnostic: { accountId: account.id, requires: params.baseCurrency },
    });
  }

  // Control-account subledger dimension requirements.
  const controlPurpose = account.controlAccountPurpose ?? null;
  const requiredDimension = controlPurpose ? CONTROL_DIMENSION_REQUIREMENTS[controlPurpose] : null;
  if (requiredDimension && !line.dimensions?.[requiredDimension]) {
    throw new ControlAccountDimensionError(
      `Account ${ref.code ?? account.id} requires the "${requiredDimension}" dimension on every line.`,
      { ...ids, diagnostic: { accountId: account.id, controlPurpose } }
    );
  }

  // Manual posting restrictions.
  if (isManual) {
    const behaviourBlocksManual =
      account.coaV2Behaviour && !behaviourAcceptsManualPostings(account.coaV2Behaviour);
    const explicitBlock = account.manualPostingAllowed === false;
    const restrictedPurpose =
      account.systemPurpose && MANUAL_RESTRICTED_PURPOSES.includes(account.systemPurpose);
    if (behaviourBlocksManual || explicitBlock || restrictedPurpose) {
      if (!hasPermission(ACCOUNTING_PERMISSIONS.POSTING_CONTROL_ACCOUNTS)) {
        throw new ApprovalInvalidError(
          `Account ${ref.code ?? account.id} is protected and cannot receive manual postings without elevated permission.`,
          { ...ids, diagnostic: { accountId: account.id, systemPurpose: account.systemPurpose } }
        );
      }
    }
  }

  // Structural line sanity (belt and braces — the draft already enforces this).
  const hasDebit = line.debit && line.debit.minor > 0;
  const hasCredit = line.credit && line.credit.minor > 0;
  if (hasDebit && hasCredit) {
    throw new InvalidJournalLineError('A journal line cannot carry both debit and credit.', ids);
  }
  if ((line.debit && line.debit.minor < 0) || (line.credit && line.credit.minor < 0)) {
    throw new InvalidJournalLineError('Negative journal line amounts are not permitted.', ids);
  }
}

/**
 * Validate every line of a draft. Loads accounts once (no N+1).
 * @param {import('@prisma/client').Prisma.TransactionClient|import('@prisma/client').PrismaClient} db
 * @param {import('../domain/accountingContext.js').AccountingContext} context
 * @param {import('../domain/journalDraft.js').JournalDraft} draft
 * @param {object} options
 * @param {boolean} [options.isManual]
 * @param {(permission: string) => boolean} options.hasPermission
 * @returns {Promise<Map<string, object>>} the loaded accounts (for reuse by callers)
 */
export async function validateDraftAccounts(db, context, draft, options) {
  assertSameBusiness(context, { tenantId: context.businessId }, 'context');
  const accounts = await loadAccountsForValidation(db, context, draft.lines.map((l) => l.accountId));
  for (const line of draft.lines) {
    validateLineAccount({
      context,
      account: accounts.get(line.accountId),
      line,
      currency: draft.currency,
      baseCurrency: context.baseCurrency,
      isManual: options.isManual ?? false,
      hasPermission: options.hasPermission,
      postingDate: draft.postingDate,
    });
  }
  return accounts;
}
