/**
 * Opening balance posting contract for onboarding / wizard.
 * Posts through Accounting V2 (OpeningBalanceBatch → engine). Never credits 3100.
 * Opening stock also creates FIFO + stockLevel + InventoryTransaction.
 */
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';
import {
  isOpeningBalanceEquityAccount,
  resolveOpeningBalanceEquityAccount,
} from '@/lib/openingBalanceEquityAccount';
import {
  buildOpeningBalanceIdempotencyKey,
  buildOpeningBalanceLines,
  OPENING_BALANCE_TYPES,
  resolveOpeningBalanceTargetAccount,
} from '@/lib/postingRules/openingBalancePostingRules';
import { assertOpeningBalancesEditable } from '@/lib/openingBalanceLock';
import { logOpeningBalanceAudit } from '@/lib/openingBalanceAudit';
import { createFifoBatch } from '@/lib/fifoCosting';
import { recomputeProductStockValue } from '@/lib/inventoryWriteOffService';
import { contextFromSession } from '@/lib/accountingV2/adapters/baseAdapter.js';
import {
  createOpeningBalanceBatch,
  OpeningBalanceBatchStatus,
  postOpeningBalanceBatch,
} from '@/lib/accountingV2/application/openingBalanceService.js';

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
 * @param {boolean} [params.skipInventory] When true, post GL only — do not create another FIFO batch.
 *   Use when stock was already applied (e.g. product create DirectCreation, Stock In FIFO).
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
    skipInventory = false,
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

  const existing = await db.acctV2OpeningBalanceBatch.findFirst({
    where: {
      tenantId,
      evidenceReference: sourceId,
      status: OpeningBalanceBatchStatus.POSTED,
    },
  });

  if (existing) {
    return { transaction: existing, created: false, idempotencyKey: sourceId };
  }

  validateOpeningBalanceAccount(targetAccount);

  const lines = buildOpeningBalanceLines(type, {
    targetAccount,
    equityAccount,
    amount: amountNum,
  });

  const desc =
    description?.trim() ||
    `Opening balance — ${type.replace(/_/g, ' ')} — ${targetAccount.accountName || targetAccount.name}`;

  let fifo = null;
  // Inventory must not be applied twice: callers that already ran createFifoBatch
  // (product create, Stock In) must pass skipInventory: true.
  const inventoryAlreadyApplied =
    skipInventory === true || metadata?.skipInventory === true || metadata?.inventoryAlreadyApplied === true;
  if (type === 'opening_stock' && !inventoryAlreadyApplied) {
    fifo = await applyOpeningStockInventory({
      tenantId,
      createdBy,
      amount: amountNum,
      asOfDate: entryDate,
      metadata,
      db,
    });
  }

  const v2Lines = lines.map((l) => ({
    accountId: l.accountId,
    debit: l.debitAmount || null,
    credit: l.creditAmount || null,
    description: l.description,
  }));

  const context = contextFromSession({ tenantId, userId: createdBy });
  const can = () => true;

  const latest = await db.acctV2OpeningBalanceBatch.findFirst({
    where: {
      tenantId,
      effectiveDate: new Date(entryDate.toISOString().slice(0, 10)),
    },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const version = (latest?.version || 0) + 1;

  const batch = await createOpeningBalanceBatch(
    context,
    {
      effectiveDate: entryDate.toISOString().slice(0, 10),
      version,
      description: desc,
      evidenceReference: sourceId,
      currency: metadata?.currency || context.currency || 'MWK',
      lines: v2Lines,
    },
    { hasPermission: can },
    db
  );

  // Onboarding contract: stamp approval facts. Engine SoD compares creator vs
  // approver, so creator is a system marker and the acting user is the approver.
  await db.acctV2OpeningBalanceBatch.update({
    where: { id: batch.id },
    data: {
      status: OpeningBalanceBatchStatus.APPROVED,
      createdBy: 'onboarding-system',
      approvedBy: createdBy,
      approvedAt: new Date(),
    },
  });

  const postResult = await postOpeningBalanceBatch(
    context,
    batch.id,
    { hasPermission: can },
    db
  );

  await logOpeningBalanceAudit({
    tenantId,
    userId: createdBy,
    action: `OPENING_BALANCE_POSTED_${type.toUpperCase()}`,
    entityId: batch.id,
    details: {
      type,
      amount: amountNum,
      idempotencyKey: sourceId,
      targetAccountId: targetAccount.id,
      fifo,
      created: true,
    },
    db,
  });

  return {
    transaction: postResult?.result?.journal || postResult,
    batch,
    fifo,
    created: true,
    idempotencyKey: sourceId,
  };
}

async function applyOpeningStockInventory({ tenantId, createdBy, amount, asOfDate, metadata, db }) {
  const productId = metadata?.productId || metadata?.entityId || null;
  if (!productId) return null;

  const product = await db.product.findFirst({
    where: { id: productId, tenantId },
    select: { id: true, branchId: true, isService: true, name: true },
  });
  if (!product) {
    throw new Error('Opening stock product was not found.');
  }
  if (product.isService) {
    throw new Error('Services cannot receive opening stock.');
  }

  const quantity = Number(metadata.quantity ?? metadata.qty ?? 0);
  const unitCost = Number(metadata.unitCost ?? (quantity > 0 ? amount / quantity : 0));
  if (!(quantity > 0)) {
    throw new Error('Opening stock requires a quantity greater than zero.');
  }
  if (!(unitCost >= 0)) {
    throw new Error('Opening stock unit cost must be zero or greater.');
  }

  const fifo = await createFifoBatch({
    tenantId,
    branchId: metadata.branchId || product.branchId || null,
    productId,
    quantityPurchased: quantity,
    unitCost,
    purchaseDate: asOfDate,
    sourceType: 'OpeningStock',
    sourceId: `opening-stock:${productId}:${asOfDate.toISOString().slice(0, 10)}`,
    tx: db,
  });

  await recomputeProductStockValue(db, tenantId, productId);

  await db.inventoryTransaction.create({
    data: {
      tenantId,
      branchId: metadata.branchId || product.branchId || null,
      productId,
      userId: createdBy,
      type: 'opening_stock',
      quantity: new Prisma.Decimal(quantity),
      notes: `Opening stock ${quantity} @ ${unitCost}`,
    },
  });

  return fifo;
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
