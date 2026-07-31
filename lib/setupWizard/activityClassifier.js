/**
 * D2 — classify business activity before starting / restarting setup.
 */

import prisma from '../prisma.js';
import {
  BUSINESS_ACTIVITY_CLASS,
  SETUP_RUN_STATUS,
  SETUP_TYPE,
} from './constants.js';
import { ExistingBusinessActivityConflictError } from './errors.js';

/**
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} [db]
 * @param {string} tenantId
 */
export async function classifyBusinessActivity(tenantId, db = prisma) {
  const [
    accountCount,
    paymentAccountCount,
    clientCount,
    productCount,
    invoiceCount,
    billCount,
    stockMoveCount,
    postedV2JournalCount,
    postedObBatchCount,
    completedSetupCount,
    postingSetupCount,
  ] = await Promise.all([
    db.account.count({ where: { tenantId } }),
    db.paymentAccount.count({ where: { tenantId } }).catch(() => 0),
    db.client.count({ where: { tenantId } }).catch(() => 0),
    db.product.count({ where: { tenantId, isDeleted: false } }).catch(() => 0),
    db.invoice.count({ where: { tenantId, isDeleted: false } }),
    db.supplierBill.count({ where: { tenantId } }).catch(() => 0),
    db.inventoryTransaction.count({ where: { tenantId } }),
    db.journalEntry.count({
      where: {
        tenantId,
        architectureVersion: 'ACCOUNTING_V2',
        OR: [{ status: 'Posted' }, { status: 'POSTED' }],
      },
    }),
    db.acctV2OpeningBalanceBatch.count({
      where: { tenantId, status: 'POSTED' },
    }),
    db.businessSetupRun
      .count({
        where: {
          tenantId,
          status: {
            in: [SETUP_RUN_STATUS.COMPLETED, SETUP_RUN_STATUS.COMPLETED_WITH_WARNINGS],
          },
        },
      })
      .catch(() => 0),
    db.businessSetupRun
      .count({
        where: { tenantId, status: SETUP_RUN_STATUS.POSTING },
      })
      .catch(() => 0),
  ]);

  const counts = {
    accountCount,
    paymentAccountCount,
    clientCount,
    productCount,
    invoiceCount,
    billCount,
    stockMoveCount,
    postedV2JournalCount,
    postedObBatchCount,
    completedSetupCount,
    postingSetupCount,
  };

  if (postingSetupCount > 0) {
    return {
      classification: BUSINESS_ACTIVITY_CLASS.BLOCKED,
      reason: 'A setup posting is already in progress.',
      counts,
    };
  }

  if (completedSetupCount > 0 || postedObBatchCount > 0) {
    return {
      classification: BUSINESS_ACTIVITY_CLASS.EXISTING_SETUP_COMPLETED,
      reason: 'Setup or opening balances were already posted for this business.',
      counts,
    };
  }

  const hasFinancialActivity =
    postedV2JournalCount > 0 ||
    invoiceCount > 0 ||
    billCount > 0 ||
    stockMoveCount > 0;

  if (hasFinancialActivity) {
    return {
      classification: BUSINESS_ACTIVITY_CLASS.EXISTING_WITH_FINANCIAL_ACTIVITY,
      reason: 'Operational financial records already exist.',
      counts,
    };
  }

  const hasMasterData = clientCount > 0 || productCount > 0;
  const hasConfig = accountCount > 0 || paymentAccountCount > 0;

  if (hasMasterData) {
    return {
      classification: BUSINESS_ACTIVITY_CLASS.EXISTING_WITHOUT_FINANCIAL_ACTIVITY,
      reason: 'Master data exists without posted financial activity.',
      counts,
    };
  }

  if (hasConfig) {
    return {
      classification: BUSINESS_ACTIVITY_CLASS.NEW_PARTIALLY_CONFIGURED_BUSINESS,
      reason: 'Chart of accounts or payment accounts exist; no financial activity yet.',
      counts,
    };
  }

  return {
    classification: BUSINESS_ACTIVITY_CLASS.NEW_EMPTY_BUSINESS,
    reason: 'No configuration or financial activity detected.',
    counts,
  };
}

/**
 * @param {{ classification: string }} result
 * @param {{ setupType?: string, conversionApproved?: boolean }} options
 */
export function assertSetupStartAllowed(result, options = {}) {
  const { classification } = result;
  const setupType = options.setupType || SETUP_TYPE.NEW_BUSINESS;
  const conversionApproved = Boolean(options.conversionApproved);

  if (classification === BUSINESS_ACTIVITY_CLASS.BLOCKED) {
    throw new ExistingBusinessActivityConflictError(classification, {
      diagnostic: { reason: result.reason },
    });
  }

  const needsConversion = [
    BUSINESS_ACTIVITY_CLASS.EXISTING_WITH_FINANCIAL_ACTIVITY,
    BUSINESS_ACTIVITY_CLASS.EXISTING_SETUP_COMPLETED,
    BUSINESS_ACTIVITY_CLASS.REQUIRES_CONTROLLED_CONVERSION,
  ].includes(classification);

  if (!needsConversion) {
    return result;
  }

  const conversionTypes = [
    SETUP_TYPE.EXISTING_BUSINESS_CONVERSION,
    SETUP_TYPE.DATA_MIGRATION,
    SETUP_TYPE.REIMPLEMENTATION_RECOVERY,
  ];

  if (!conversionTypes.includes(setupType) || !conversionApproved) {
    throw new ExistingBusinessActivityConflictError(
      BUSINESS_ACTIVITY_CLASS.REQUIRES_CONTROLLED_CONVERSION,
      {
        diagnostic: {
          classification,
          setupType,
          conversionApproved,
          reason: result.reason,
        },
      }
    );
  }

  return {
    ...result,
    classification: BUSINESS_ACTIVITY_CLASS.REQUIRES_CONTROLLED_CONVERSION,
  };
}
