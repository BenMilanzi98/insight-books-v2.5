/**
 * Accounting V2 — legacy trial balance adapter.
 *
 * READS: `lib/trialBalanceReport.js#buildTrialBalance` (posted dual-ledger GL).
 * WRITES: nothing.
 *
 * Known inherited defects (documented, NOT corrected — Phase 7):
 *  - Group-header accounts are not skipped (TB-003 parent/child double-count hazard).
 *  - Header-amount legacy journals (JRN-009) can distort per-account totals.
 * Removal: Phase 7 replaces this with the V2 trial balance built on the V2 ledger.
 * Flag: `accountingV2NewTrialBalance` (currently always legacy).
 */

import { buildTrialBalance } from '../../../trialBalanceReport.js';
import prisma from '../../../prisma.js';

/**
 * @param {import('../../domain/accountingContext.js').AccountingContext} context
 * @param {{startDate: Date|string, endDate: Date|string, branchId?: string|null, includeZero?: boolean}} query
 * @param {import('@prisma/client').PrismaClient} [db]
 */
export async function getLegacyTrialBalance(context, query, db = prisma) {
  return buildTrialBalance({
    tenantId: context.businessId,
    branchId: query.branchId ?? null,
    startDate: query.startDate,
    endDate: query.endDate,
    includeZero: query.includeZero ?? false,
    prisma: db,
  });
}
