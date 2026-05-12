/**
 * Single rule for whether GL activity may update {@link Account.balance} on a row:
 * structural section roots, rollups with active children, and retired/header flags must not receive direct postings.
 */

import { isCoaStructuralRootCode } from './coaPostingCodes.js';

/**
 * @param {{ accountName?: string|null; name?: string|null; accountCode?: string|null; code?: string|null }} account
 */
export function coaAccountDisplayLabel(account) {
  if (!account) return '';
  const code = String(account.accountCode ?? account.code ?? '').trim();
  const name = String(account.accountName ?? account.name ?? '').trim();
  if (code && name) return `${code} — ${name}`;
  return code || name || '';
}

/**
 * @param {object} account - Prisma Account row or subset with code fields, acceptsNewTransactions, _count.childAccounts
 * @param {{ activeChildCount?: number }} [overrides] - when _count is unavailable, pass explicit active child count
 * @returns {{ blocked: boolean, reason?: string, details?: string }}
 */
export function accountBlocksDirectPosting(account, overrides = {}) {
  if (!account) {
    return { blocked: true, reason: 'Account not found.', details: '' };
  }

  const glCode = String(account.accountCode ?? account.code ?? '').trim();
  if (isCoaStructuralRootCode(glCode)) {
    return {
      blocked: true,
      reason:
        'Structural chart section headers (1000, 2000, 3000, 4000, 5000) cannot receive direct postings. Use a detail account under this section.',
      details: glCode || coaAccountDisplayLabel(account),
    };
  }

  if (account.acceptsNewTransactions === false) {
    return {
      blocked: true,
      reason:
        'This account is not open for new postings (consolidation, merged source, or retired). Choose an active detail account.',
      details: coaAccountDisplayLabel(account) || glCode || account.id,
    };
  }

  /** Operating cash ledger: all cash postings hit **1110** only (1111–1119 are legacy / non-posting). */
  if (glCode === '1110') {
    return { blocked: false };
  }

  const fromCount =
    account._count?.childAccounts != null ? Number(account._count.childAccounts) : null;
  const activeChildren =
    overrides.activeChildCount != null
      ? Number(overrides.activeChildCount)
      : fromCount != null && !Number.isNaN(fromCount)
        ? fromCount
        : null;

  if (activeChildren != null && activeChildren > 0) {
    return {
      blocked: true,
      reason:
        'This account is a consolidation parent: post only to a sub-account beneath it, not to the rollup line.',
      details: coaAccountDisplayLabel(account) || glCode || account.id,
    };
  }

  return { blocked: false };
}

/**
 * @param {Array<object>} accounts - rows suitable for {@link accountBlocksDirectPosting}
 * @returns {{ ok: true } | { ok: false, error: string, details?: string }}
 */
export function validateLineAccountsAllowDirectPosting(accounts) {
  for (const acc of accounts || []) {
    const r = accountBlocksDirectPosting(acc);
    if (r.blocked) {
      return {
        ok: false,
        error: r.reason || 'This account cannot receive direct postings.',
        details: r.details,
      };
    }
  }
  return { ok: true };
}

/**
 * @param {string[]} accountIds
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} tx
 */
export async function assertAccountsAllowDirectPosting(accountIds, tx) {
  const ids = [...new Set((accountIds || []).filter(Boolean))];
  if (ids.length === 0) return;

  const accounts = await tx.account.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      accountCode: true,
      code: true,
      accountName: true,
      name: true,
      acceptsNewTransactions: true,
      _count: {
        select: {
          childAccounts: { where: { isActive: true } },
        },
      },
    },
  });

  if (accounts.length !== ids.length) {
    throw new Error('One or more GL accounts were not found for this tenant.');
  }

  const r = validateLineAccountsAllowDirectPosting(accounts);
  if (!r.ok) {
    throw new Error(r.details ? `${r.error} (${r.details})` : r.error);
  }
}
