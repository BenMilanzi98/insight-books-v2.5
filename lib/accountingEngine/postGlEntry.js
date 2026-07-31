/**
 * Centralized GL posting engine — all modules should route double-entry postings here.
 * Creates Transaction + TransactionLine rows, validates balance/period/accounts, and updates balances.
 */

import prisma from '../prisma.js';
import { validateTransactionBalance } from '../accountingValidation.js';
import { updateAccountBalanceOnTransaction } from '../accountBalanceService.js';
import { assertAccountsAllowDirectPosting } from '../coaDirectPostingEligibility.js';
import { assertPeriodOpen } from '../accountingPeriodService.js';
import { assertNoDuplicatePostedSource } from '../accountingMappingRules.js';
import { generateReferenceNumber } from '../journalService.js';
import { roundMoney } from '../money.js';
import { assertLegacyPostingAllowed } from '../accountingV2/engine/legacyGuard.js';

export class AccountingEngineError extends Error {
  constructor(message, code = 'ACCOUNTING_ENGINE_ERROR') {
    super(message);
    this.name = 'AccountingEngineError';
    this.code = code;
  }
}

function normalizeLines(rawLines) {
  return rawLines.map((line, idx) => ({
    lineNumber: line.lineNumber ?? idx + 1,
    accountId: line.accountId,
    debitAmount: roundMoney(line.debitAmount || 0),
    creditAmount: roundMoney(line.creditAmount || 0),
    description: line.description?.trim() || null,
  }));
}

/**
 * Post a balanced double-entry GL transaction.
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.userId
 * @param {Date|string} params.entryDate
 * @param {string} params.description
 * @param {string} [params.reference] Auto-generated when omitted
 * @param {string} [params.sourceType] Module source e.g. capital_contribution, Invoice
 * @param {string} [params.sourceId] Idempotency key — must be stable per source document
 * @param {string} [params.entryType='Regular']
 * @param {string|null} [params.branchId]
 * @param {Array<{ accountId: string, debitAmount?: number, creditAmount?: number, description?: string, lineNumber?: number }>} params.lines
 * @param {boolean} [params.skipDuplicateCheck=false]
 * @param {boolean} [params.skipBalanceUpdate=false]
 * @param {boolean} [params.isReversal=false]
 * @param {string|null} [params.reversedTransactionId]
 * @param {string|null} [params.reversalReason]
 * @param {Date|string|null} [params.reversedAt]
 * @param {string|null} [params.reversedById]
 * @param {boolean} [params.allowBlockedAccountForReversal=false]
 * @param {import('@prisma/client').PrismaClient|import('@prisma/client').Prisma.TransactionClient} [params.tx]
 * @returns {Promise<import('@prisma/client').Transaction & { lines: import('@prisma/client').TransactionLine[] }>}
 */
export async function postGlEntry({
  tenantId,
  userId,
  entryDate,
  description,
  reference,
  sourceType,
  sourceId,
  entryType = 'Regular',
  branchId = null,
  lines: rawLines,
  skipDuplicateCheck = false,
  skipBalanceUpdate = false,
  isReversal = false,
  reversedTransactionId = null,
  reversalReason = null,
  reversedAt = null,
  reversedById = null,
  allowBlockedAccountForReversal = false,
  tx = null,
}) {
  // Fresh-books V2-only: Transaction ledger writers are permanently retired.
  throw new AccountingEngineError(
    'Legacy postGlEntry is removed. Use executePosting / V2 adapters (NEW_ENGINE).',
    'LEGACY_POSTING_REMOVED'
  );

  if (!tenantId || !userId) {
    throw new AccountingEngineError('tenantId and userId are required.');
  }
  if (!description?.trim()) {
    throw new AccountingEngineError('Description is required.');
  }
  if (!rawLines?.length || rawLines.length < 2) {
    throw new AccountingEngineError('At least two GL lines are required for double-entry posting.');
  }

  const lines = normalizeLines(rawLines);
  for (const line of lines) {
    if (!line.accountId) {
      throw new AccountingEngineError('Every line must reference an account.');
    }
    if (line.debitAmount === 0 && line.creditAmount === 0) {
      throw new AccountingEngineError('Each line must have a debit or credit amount.');
    }
    if (line.debitAmount > 0 && line.creditAmount > 0) {
      throw new AccountingEngineError('A line cannot have both debit and credit amounts.');
    }
  }

  const balanceValidation = validateTransactionBalance(lines);
  if (!balanceValidation.isValid) {
    throw new AccountingEngineError(balanceValidation.error, 'UNBALANCED_ENTRY');
  }

  const date = entryDate instanceof Date ? entryDate : new Date(entryDate);
  if (Number.isNaN(date.getTime())) {
    throw new AccountingEngineError('Invalid entry date.');
  }

  const db = tx || prisma;

  // Legacy↔V2 guard: refuse when the V2 engine is authoritative for this event
  // scope or has already posted this source (prevents duplicate active effects).
  await assertLegacyPostingAllowed({ tenantId, sourceType, sourceId }, db);

  await assertPeriodOpen(tenantId, date, db);

  const accountIds = [...new Set(lines.map((l) => l.accountId))];
  await assertAccountsAllowDirectPosting(accountIds, db, {
    allowBlockedAccountForReversal,
  });

  if (sourceType && sourceId && !skipDuplicateCheck) {
    await assertNoDuplicatePostedSource({
      tenantId,
      sourceType,
      sourceId,
      db,
    });
  }

  const execute = async (client) => {
    const ref = reference || (await generateReferenceNumber(client, tenantId, date));
    const stableSourceId = sourceId || ref;

    const transaction = await client.transaction.create({
      data: {
        tenantId,
        date,
        reference: ref,
        description: description.trim(),
        entryType,
        status: 'posted',
        sourceType: sourceType || 'gl_posting',
        sourceId: stableSourceId,
        branchId: branchId || undefined,
        createdById: userId,
        postedById: userId,
        postedDate: new Date(),
        isReversal,
        ...(reversedTransactionId ? { reversedTransactionId } : {}),
        ...(reversalReason ? { reversalReason: reversalReason.trim() } : {}),
        ...(reversedAt ? { reversedAt: reversedAt instanceof Date ? reversedAt : new Date(reversedAt) } : {}),
        ...(reversedById ? { reversedById } : {}),
        lines: { create: lines },
      },
      include: { lines: true },
    });

    if (!skipBalanceUpdate) {
      const balanceOptions = allowBlockedAccountForReversal
        ? { allowBlockedAccountForReversal: true }
        : {};
      for (const line of transaction.lines) {
        await updateAccountBalanceOnTransaction(
          line.accountId,
          line.debitAmount,
          line.creditAmount,
          client,
          balanceOptions
        );
      }
    }

    return transaction;
  };

  if (tx) {
    return execute(tx);
  }
  return prisma.$transaction(execute);
}
