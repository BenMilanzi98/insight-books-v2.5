/**
 * Period-close feed for BANK_RECONCILIATION_REVIEWED.
 * When flag enabled, becomes an automatic check against completed recon sessions.
 */

import { BankRecStatus, RECONCILABLE_PAYMENT_TYPES } from '../domain/enums.js';
import { BANK_RECON_FLAGS } from '../../accountingV2/infrastructure/featureFlags.js';
import { isFlagEnabled } from '../../accountingV2/infrastructure/featureFlags.js';

/**
 * Evaluate whether bank reconciliations cover the period end for all active reconcilable accounts.
 * @returns {{ ok: boolean, warning?: boolean, result: object }}
 */
export async function evaluateBankReconciliationClose(db, context, period) {
  const enabled = await isFlagEnabled(db, BANK_RECON_FLAGS.PERIOD_CLOSE_FEED, {
    tenantId: context.businessId,
  });
  const moduleEnabled = await isFlagEnabled(db, BANK_RECON_FLAGS.ENABLED, {
    tenantId: context.businessId,
  });

  if (!enabled || !moduleEnabled) {
    return {
      ok: true,
      warning: true,
      automatic: false,
      result: {
        rule: 'BANK_RECONCILIATION_REVIEWED',
        mode: 'MANUAL_FALLBACK',
        message: 'Bank reconciliation period-close feed disabled; manual checklist applies.',
      },
    };
  }

  const accounts = await db.paymentAccount.findMany({
    where: {
      tenantId: context.businessId,
      isActive: true,
      accountType: { in: [...RECONCILABLE_PAYMENT_TYPES] },
      coaAccountId: { not: null },
    },
    select: { id: true, name: true },
  });

  const configs = await db.bankRecConfiguration.findMany({
    where: {
      tenantId: context.businessId,
      paymentAccountId: { in: accounts.map((a) => a.id) },
      enabled: true,
    },
  });
  const enabledIds = new Set(configs.map((c) => c.paymentAccountId));
  // If no configs, treat all reconcilable accounts as in scope
  const inScope = configs.length ? accounts.filter((a) => enabledIds.has(a.id)) : accounts;

  const periodEnd = new Date(period.endDate);
  const missing = [];
  const completed = [];

  for (const account of inScope) {
    const recon = await db.bankRecReconciliation.findFirst({
      where: {
        tenantId: context.businessId,
        paymentAccountId: account.id,
        status: BankRecStatus.COMPLETED,
        statementDate: { lte: periodEnd },
      },
      orderBy: { statementDate: 'desc' },
    });
    if (!recon) {
      // Approved exception on open recon for the period?
      const waived = await db.bankRecException.findFirst({
        where: {
          tenantId: context.businessId,
          status: 'WAIVED',
          code: 'PERIOD_CLOSE_WAIVER',
          reconciliation: {
            paymentAccountId: account.id,
            tenantId: context.businessId,
          },
        },
      });
      if (!waived) missing.push({ paymentAccountId: account.id, name: account.name });
    } else {
      completed.push({ paymentAccountId: account.id, reconciliationId: recon.id, statementDate: recon.statementDate });
    }
  }

  const ok = missing.length === 0;
  return {
    ok,
    warning: false,
    automatic: true,
    result: {
      rule: 'BANK_RECONCILIATION_REVIEWED',
      mode: 'LIVE_FEED',
      expected: inScope.length,
      actualCompleted: completed.length,
      missing,
      completed: completed.slice(0, 50),
    },
  };
}
