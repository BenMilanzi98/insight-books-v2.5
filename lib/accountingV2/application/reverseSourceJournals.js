/**
 * Fresh-books Phase 2 — reverse posted ACCOUNTING_V2 journals by source identity.
 *
 * Finds JournalEntry rows by sourceType/sourceId (plus common sourceId suffixes)
 * and reverses each via reverseJournal. Fail-closed when a document requires
 * reversal but no unreversed V2 journal exists.
 */

import prisma from '../../prisma.js';
import { createAccountingContext } from '../domain/accountingContext.js';
import { reverseJournal } from './journalReversalService.js';


const DEFAULT_SOURCE_ID_SUFFIXES = ['-revenue', '-tax', '-payment', '-cogs'];

/**
 * @param {string|null|undefined} sourceId
 * @param {string[]} [extraSuffixes]
 * @returns {string[]}
 */
export function buildSourceIdCandidates(sourceId, extraSuffixes = []) {
  if (sourceId == null || sourceId === '') return [];
  const id = String(sourceId);
  const suffixes = [...DEFAULT_SOURCE_ID_SUFFIXES, ...extraSuffixes];
  return [...new Set([id, ...suffixes.map((s) => `${id}${s}`)])];
}

/**
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string|string[]} params.sourceTypes
 * @param {string|string[]} params.sourceIds
 * @param {import('@prisma/client').PrismaClient} [params.db]
 */
export async function findV2JournalsBySource({
  tenantId,
  sourceTypes,
  sourceIds,
  db = prisma,
}) {
  const types = (Array.isArray(sourceTypes) ? sourceTypes : [sourceTypes]).filter(Boolean);
  const ids = (Array.isArray(sourceIds) ? sourceIds : [sourceIds]).filter(Boolean);
  if (!tenantId || types.length === 0 || ids.length === 0) return [];

  return db.journalEntry.findMany({
    where: {
      tenantId,
      architectureVersion: 'ACCOUNTING_V2',
      status: 'Posted',
      sourceType: { in: types },
      sourceId: { in: ids },
    },
    select: {
      id: true,
      sourceType: true,
      sourceId: true,
      journalNumber: true,
      reversedByJournalId: true,
      reversalStatus: true,
      status: true,
    },
    orderBy: { createdAt: 'asc' },
  });
}

function makeNoV2JournalError({ tenantId, sourceTypes, sourceIds }) {
  const err = new Error(
    `No posted V2 journal found to reverse (sourceTypes=${JSON.stringify(sourceTypes)}, sourceIds=${JSON.stringify(sourceIds)}).`
  );
  err.code = 'NO_V2_JOURNAL_TO_REVERSE';
  err.details = { tenantId, sourceTypes, sourceIds };
  return err;
}

/**
 * Reverse all unreversed posted V2 journals matching source identity.
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.userId
 * @param {string} params.reason
 * @param {string|string[]} params.sourceTypes
 * @param {string|string[]} [params.sourceIds] raw ids (will expand suffixes unless expandIds=false)
 * @param {string|string[]} [params.sourceIdCandidates] pre-expanded ids (skips expand when set)
 * @param {boolean} [params.requireJournals=true] throw NO_V2_JOURNAL_TO_REVERSE when none found
 * @param {boolean} [params.expandIds=true]
 * @param {string|null} [params.postingDate]
 * @param {(p: string) => boolean} [params.hasPermission]
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} [params.db]
 * Pass an interactive transaction client to make all reversal writes part of its transaction.
 * @returns {Promise<{ journalsFound: number, reversed: object[], skippedAlreadyReversed: string[] }>}
 */
export async function reverseSourceJournals({
  tenantId,
  userId,
  reason,
  sourceTypes,
  sourceIds = [],
  sourceIdCandidates = null,
  requireJournals = true,
  expandIds = true,
  postingDate = null,
  hasPermission = () => true,
  approvalOverride = null,
  db = prisma,
}) {
  const types = (Array.isArray(sourceTypes) ? sourceTypes : [sourceTypes]).filter(Boolean);
  const ids = sourceIdCandidates
    ? (Array.isArray(sourceIdCandidates) ? sourceIdCandidates : [sourceIdCandidates]).filter(Boolean)
    : expandIds
      ? [...new Set(
          (Array.isArray(sourceIds) ? sourceIds : [sourceIds])
            .filter(Boolean)
            .flatMap((id) => buildSourceIdCandidates(id))
        )]
      : (Array.isArray(sourceIds) ? sourceIds : [sourceIds]).filter(Boolean);

  const journals = await findV2JournalsBySource({
    tenantId,
    sourceTypes: types,
    sourceIds: ids,
    db,
  });

  if (journals.length === 0) {
    if (requireJournals) {
      throw makeNoV2JournalError({ tenantId, sourceTypes: types, sourceIds: ids });
    }
    return { journalsFound: 0, reversed: [], skippedAlreadyReversed: [] };
  }

  const context = createAccountingContext({
    businessId: tenantId,
    userId,
    sourceChannel: 'reversal',
  });

  // Callers that omit hasPermission default to allow (legacy adapters).
  // When a real checker is passed, JOURNAL_REVERSE is enforced by reverseJournal.
  const effectivePerm =
    typeof hasPermission === 'function' ? hasPermission : () => true;


  const skippedAlreadyReversed = [];
  const reversed = [];

  for (const journal of journals) {
    if (journal.reversedByJournalId || journal.reversalStatus === 'REVERSED') {
      skippedAlreadyReversed.push(journal.id);
      continue;
    }

    const result = await reverseJournal(
      context,
      journal.id,
      {
        reason: String(reason || '').trim() || 'Document reversal',
        postingDate,
        hasPermission: effectivePerm,
        approvalOverride,
      },
      db
    );
    reversed.push({
      originalJournalId: journal.id,
      sourceType: journal.sourceType,
      sourceId: journal.sourceId,
      journalNumber: journal.journalNumber,
      result,
    });
  }

  // All matching journals were already reversed — treat as success (idempotent).
  if (reversed.length === 0 && skippedAlreadyReversed.length === 0 && requireJournals) {
    throw makeNoV2JournalError({ tenantId, sourceTypes: types, sourceIds: ids });
  }

  return {
    journalsFound: journals.length,
    reversed,
    skippedAlreadyReversed,
  };
}
