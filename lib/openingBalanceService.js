/**
 * Opening balance posting — all entries via postGlEntry (AccountingService.post equivalent).
 */
import prisma from '@/lib/prisma';
import { postGlEntry } from '@/lib/accountingEngine/postGlEntry';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';
import { resolveOpeningBalanceEquityAccount } from '@/lib/openingBalanceEquityAccount';
import {
  buildOpeningBalanceIdempotencyKey,
  buildOpeningBalanceLines,
  OPENING_BALANCE_TYPES,
  resolveOpeningBalanceTargetAccount,
} from '@/lib/postingRules/openingBalancePostingRules';
import { isOpeningBalanceEquityAccount } from '@/lib/openingBalanceEquityAccount';
import { assertOpeningBalancesEditable } from '@/lib/openingBalanceLock';
import { logOpeningBalanceAudit } from '@/lib/openingBalanceAudit';

/**
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string|null} [params.businessId]
 * @param {string} params.type
 * @param {string|null} [params.accountId]
 * @param {string|null} [params.entityId]
 * @param {number} params.amount
 * @param {Date|string} params.asOfDate
 * @param {string} [params.description]
 * @param {object} [params.metadata]
 * @param {string} params.createdBy
 * @param {import('@prisma/client').PrismaClient|import('@prisma/client').Prisma.TransactionClient} [params.db]
 */
export async function postOpeningBalance(params) {
  const {
    tenantId,
    businessId = null,
    type,
    accountId = null,
    entityId = null,
    amount,
    asOfDate,
    description,
    metadata = {},
    createdBy,
    db = prisma,
  } = params;

  if (!tenantId || !createdBy) {
    throw new Error('tenantId and createdBy are required.');
  }
  if (!OPENING_BALANCE_TYPES.includes(type)) {
    throw new Error(`Invalid opening balance type: ${type}`);
  }

  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    throw new Error('Opening amount must be greater than zero.');
  }

  const entryDate = asOfDate instanceof Date ? asOfDate : new Date(asOfDate);
  if (Number.isNaN(entryDate.getTime())) {
    throw new Error('Invalid as-of date for opening balance.');
  }

  await assertOpeningBalancesEditable(tenantId, db);
  await assertPeriodOpen(tenantId, entryDate, db);

  const targetAccount = await resolveOpeningBalanceTargetAccount(type, tenantId, accountId, db);
  const equityAccount = await resolveOpeningBalanceEquityAccount(tenantId, db);

  const sourceId = buildOpeningBalanceIdempotencyKey({
    tenantId,
    businessId,
    type,
    accountId: targetAccount.id,
    entityId,
    asOfDate: entryDate,
  });

  const existing = await db.transaction.findFirst({
    where: {
      tenantId,
      sourceType: 'onboarding',
      sourceId,
      status: 'posted',
      isReversal: false,
    },
    include: { lines: true },
  });

  if (existing) {
    return { transaction: existing, created: false, idempotencyKey: sourceId };
  }

  const lines = buildOpeningBalanceLines(type, {
    targetAccount,
    equityAccount,
    amount: amountNum,
  });

  const desc =
    description?.trim() ||
    `Opening balance — ${type.replace(/_/g, ' ')} — ${targetAccount.accountName || targetAccount.name}`;

  const transaction = await postGlEntry({
    tenantId,
    userId: createdBy,
    entryDate,
    description: desc,
    sourceType: 'onboarding',
    sourceId,
    entryType: 'Opening',
    lines,
    tx: db.$transaction ? undefined : db,
  });

  if (metadata && Object.keys(metadata).length) {
    try {
      await db.transaction.update({
        where: { id: transaction.id },
        data: { notes: JSON.stringify({ ...metadata, openingBalanceType: type }) },
      });
    } catch {
      /* notes optional */
    }
  }

  await logOpeningBalanceAudit({
    tenantId,
    userId: createdBy,
    action: `OPENING_BALANCE_POSTED_${type.toUpperCase()}`,
    entityId: transaction.id,
    details: {
      type,
      amount: amountNum,
      idempotencyKey: sourceId,
      targetAccountId: targetAccount.id,
      created: true,
    },
    db,
  });

  return { transaction, created: true, idempotencyKey: sourceId };
}

/**
 * Persist tenant starting date for opening balances.
 */
export async function setOpeningBalancesStartingDate(tenantId, asOfDate, userId, db = prisma) {
  await assertOpeningBalancesEditable(tenantId, db);
  const date = asOfDate instanceof Date ? asOfDate : new Date(asOfDate);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid starting date.');
  }
  await assertPeriodOpen(tenantId, date, db);

  await db.tenantSettings.upsert({
    where: { tenantId },
    create: { tenantId, openingBalancesAsOfDate: date },
    update: { openingBalancesAsOfDate: date },
  });

  await logOpeningBalanceAudit({
    tenantId,
    userId,
    action: 'OPENING_BALANCE_STARTING_DATE_SET',
    details: { asOfDate: date.toISOString() },
    db,
  });

  return date;
}

export async function getOpeningBalancesStartingDate(tenantId, db = prisma) {
  const s = await db.tenantSettings.findUnique({
    where: { tenantId },
    select: { openingBalancesAsOfDate: true },
  });
  return s?.openingBalancesAsOfDate || null;
}

/**
 * Validate account is eligible for opening balance (not header, not 3190 manual post target from UI).
 */
export function validateOpeningBalanceAccount(account) {
  if (!account?.isActive) {
    throw new Error('Account must be active.');
  }
  if (isOpeningBalanceEquityAccount(account)) {
    throw new Error('Opening Balance Equity (3190) cannot be used as a target account.');
  }
  const subtype = String(account.accountSubtype || '').toLowerCase();
  if (subtype === 'group') {
    throw new Error('Header/group accounts cannot receive opening balances.');
  }
}

/**
 * Post summary opening stock value to inventory GL + Opening Balance Equity.
 */
export async function postOpeningStockBalance(params) {
  return postOpeningBalance({ ...params, type: 'opening_stock' });
}

export { OPENING_BALANCE_TYPES, buildOpeningBalanceIdempotencyKey };
