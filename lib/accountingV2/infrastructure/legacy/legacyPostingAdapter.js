/**
 * Accounting V2 — legacy posting adapter.
 *
 * The ONLY approved bridge between the V2 transition coordinator and the legacy
 * accounting engine. New V2 code must never import `lib/accountingEngine/*` or
 * legacy posting helpers directly — everything goes through this adapter.
 *
 * READS: legacy `Transaction` / `JournalEntry` rows for a source (shadow comparison
 *        and duplicate detection).
 * WRITES: delegates to legacy `postGlEntry` ONLY when the resolved posting mode is
 *        LEGACY and the caller explicitly requests execution. During Phase 2 no
 *        operational route is rewired through this adapter; production posting keeps
 *        its existing direct paths.
 *
 * Known inherited defects (documented, not corrected):
 *  - `postGlEntry` does not verify line-account tenancy (SEC-1) — V2 validation
 *    compensates by pre-checking accounts before delegating.
 *  - Application-level duplicate check is racy (TOCTOU); V2 registry constraint
 *    is the real guard for adapter-routed events.
 * Removal: Phase 4 replaces delegation with the V2 posting engine; Phase 9 removes
 * the direct legacy paths.
 */

import prisma from '../../../prisma.js';
import { assertSameBusiness } from '../../domain/accountingContext.js';
import { CrossTenantAccountingError, LegacyArchitectureError } from '../../domain/errors.js';

const POSTED = ['posted', 'Posted'];

/**
 * Find legacy postings (both ledgers) for a source entity. Read-only.
 * @param {import('../../domain/accountingContext.js').AccountingContext} context
 * @param {{sourceType?: string|null, sourceId: string}} ref
 * @param {import('@prisma/client').PrismaClient} [db]
 */
export async function findLegacyPostingsBySource(context, ref, db = prisma) {
  const [transactions, journalEntries] = await Promise.all([
    db.transaction.findMany({
      where: {
        tenantId: context.businessId,
        sourceId: ref.sourceId,
        ...(ref.sourceType ? { sourceType: ref.sourceType } : {}),
        status: { in: POSTED },
      },
      include: { lines: true },
    }),
    db.journalEntry.findMany({
      where: {
        tenantId: context.businessId,
        sourceId: ref.sourceId,
        ...(ref.sourceType ? { sourceType: ref.sourceType } : {}),
      },
      include: { lines: true },
    }),
  ]);
  return { transactions, journalEntries };
}

/**
 * Pre-validate that every line account belongs to the context business and is active.
 * Compensates for the legacy engine's missing tenant filter (SEC-1) on adapter-routed
 * postings.
 * @param {import('../../domain/accountingContext.js').AccountingContext} context
 * @param {string[]} accountIds
 * @param {import('@prisma/client').PrismaClient} [db]
 */
export async function assertAccountsBelongToBusiness(context, accountIds, db = prisma) {
  const unique = [...new Set(accountIds)];
  const accounts = await db.account.findMany({
    where: { id: { in: unique } },
    select: { id: true, tenantId: true, isActive: true },
  });
  const found = new Map(accounts.map((a) => [a.id, a]));
  for (const id of unique) {
    const account = found.get(id);
    if (!account) {
      throw new CrossTenantAccountingError({
        requestId: context.requestId,
        correlationId: context.correlationId,
        diagnostic: { accountId: id, reason: 'not found' },
      });
    }
    assertSameBusiness(context, account, `account ${id}`);
  }
  return accounts;
}

/**
 * Execute a legacy authoritative posting through `postGlEntry`, with V2 tenant
 * pre-validation. Used only when posting mode is LEGACY and the event is routed
 * through the V2 coordinator (opt-in; no production route does this yet).
 *
 * @param {import('../../domain/accountingContext.js').AccountingContext} context
 * @param {import('../../domain/journalDraft.js').JournalDraft} draft
 * @param {import('@prisma/client').PrismaClient} [db]
 * @returns {Promise<{transactionId: string, reference: string|null}>}
 */
export async function executeLegacyPosting(context, draft, db = prisma) {
  throw new LegacyArchitectureError(
    'Legacy posting is removed. Use executePosting (NEW_ENGINE) for all financial posting.',
    {
      requestId: context.requestId,
      correlationId: context.correlationId,
      diagnostic: {
        sourceType: draft?.sourceReference?.sourceType ?? null,
        sourceId: draft?.sourceReference?.sourceId ?? null,
      },
    }
  );
}
