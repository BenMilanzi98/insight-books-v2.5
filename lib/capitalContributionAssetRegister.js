import prisma from '@/lib/prisma';

/** Notes marker linking an Asset row to a capital-contribution transaction. */
export const CAPITAL_CONTRIBUTION_NOTE_PREFIX = 'CAPITAL_CONTRIBUTION:';

const ASSET_TYPE_CATEGORY_NAMES = {
  equipment: 'Equipment',
  'motor vehicle': 'Motor Vehicles',
  vehicle: 'Motor Vehicles',
  furniture: 'Furniture & Fixtures',
  'furniture & fixtures': 'Furniture & Fixtures',
  computer: 'Computer & Electronics',
  'computer & electronics': 'Computer & Electronics',
  machinery: 'Machinery',
  building: 'Buildings',
  land: 'Land',
  software: 'Software / Intangible',
  'software / intangible': 'Software / Intangible',
  other: 'Owner Contributed Assets',
};

const DEFAULT_USEFUL_LIFE_YEARS = {
  equipment: 5,
  'motor vehicle': 5,
  vehicle: 5,
  furniture: 7,
  computer: 3,
  machinery: 10,
  building: 25,
  land: 99,
  software: 3,
  default: 5,
};

function normalizeTypeKey(assetType) {
  return String(assetType || '')
    .trim()
    .toLowerCase();
}

export function resolveCategoryNameFromAssetType(assetType) {
  const key = normalizeTypeKey(assetType);
  if (ASSET_TYPE_CATEGORY_NAMES[key]) return ASSET_TYPE_CATEGORY_NAMES[key];
  const raw = String(assetType || '').trim();
  if (raw) return raw;
  return 'Owner Contributed Assets';
}

export function resolveUsefulLifeYears(assetType) {
  const key = normalizeTypeKey(assetType);
  return DEFAULT_USEFUL_LIFE_YEARS[key] ?? DEFAULT_USEFUL_LIFE_YEARS.default;
}

export function capitalContributionNotesMarker(transactionId) {
  return `${CAPITAL_CONTRIBUTION_NOTE_PREFIX}${transactionId}`;
}

export function isCapitalContributionAssetNotes(notes) {
  return String(notes || '').includes(CAPITAL_CONTRIBUTION_NOTE_PREFIX);
}

/**
 * Resolve or create an asset category for a capital contribution.
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 */
export async function resolveOrCreateAssetCategoryForContribution(
  tenantId,
  assetType,
  db = prisma
) {
  const categoryName = resolveCategoryNameFromAssetType(assetType);

  const existing = await db.assetCategory.findFirst({
    where: {
      tenantId,
      name: { equals: categoryName, mode: 'insensitive' },
    },
  });
  if (existing) return existing;

  try {
    return await db.assetCategory.create({
      data: {
        tenantId,
        name: categoryName,
        description: 'Created from owner capital contribution',
      },
    });
  } catch (e) {
    if (e.code === 'P2002') {
      const again = await db.assetCategory.findFirst({
        where: {
          tenantId,
          name: { equals: categoryName, mode: 'insensitive' },
        },
      });
      if (again) return again;
    }
    throw e;
  }
}

/**
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 */
export async function findAssetByCapitalContribution(tenantId, transactionId, db = prisma) {
  const marker = capitalContributionNotesMarker(transactionId);
  return db.asset.findFirst({
    where: {
      tenantId,
      notes: { contains: marker },
    },
    include: {
      category: true,
      glAccount: {
        select: { id: true, accountCode: true, accountName: true },
      },
    },
  });
}

/**
 * Register an asset in /asset-management when GL was already posted via capital contribution.
 * Does not create duplicate journal entries.
 *
 * @param {{
 *   tenantId: string,
 *   userId: string,
 *   transactionId: string,
 *   reference?: string|null,
 *   assetName?: string|null,
 *   assetType?: string|null,
 *   debitAccount?: { id: string }|null,
 *   amount: number,
 *   purchaseDate: Date,
 *   description?: string|null,
 * }} params
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} [db]
 */
export async function registerAssetFromCapitalContribution(params, db = prisma) {
  const {
    tenantId,
    userId,
    transactionId,
    reference,
    assetName,
    assetType,
    debitAccount,
    amount,
    purchaseDate,
    description,
  } = params;

  if (!tenantId || !userId || !transactionId || !amount || amount <= 0) {
    return null;
  }

  const existing = await findAssetByCapitalContribution(tenantId, transactionId, db);
  if (existing) return existing;

  const category = await resolveOrCreateAssetCategoryForContribution(tenantId, assetType, db);
  const usefulLifeYears = resolveUsefulLifeYears(assetType);
  const typeKey = normalizeTypeKey(assetType);

  const name = (
    assetName?.trim() ||
    description?.trim() ||
    'Owner contributed asset'
  ).slice(0, 255);

  const notes = [
    capitalContributionNotesMarker(transactionId),
    reference ? `Ref: ${reference}` : null,
    description?.trim() || null,
  ]
    .filter(Boolean)
    .join('\n');

  const asset = await db.asset.create({
    data: {
      tenantId,
      createdById: userId,
      name,
      description: description?.trim() || null,
      categoryId: category.id,
      purchaseDate: purchaseDate instanceof Date ? purchaseDate : new Date(purchaseDate),
      originalCost: amount,
      usefulLifeYears,
      depreciationMethod: typeKey === 'land' ? 'none' : 'straight_line',
      status: 'active',
      isExistingAsset: true,
      accumulatedDepreciation: 0,
      glAccountId: debitAccount?.id ?? null,
      notes,
    },
    include: {
      category: true,
      glAccount: {
        select: { id: true, accountCode: true, accountName: true },
      },
    },
  });

  await db.assetJournalEntry.create({
    data: {
      assetId: asset.id,
      entryType: 'capital_contribution',
      amount,
      description: `GL posted via capital contribution (${reference || transactionId})`,
    },
  });

  return asset;
}

function isCashLikeAccount(account) {
  const name = (account?.name || account?.accountName || '').toLowerCase();
  return (
    name.includes('cash') ||
    name.includes('bank') ||
    name.includes('checking') ||
    name.includes('savings') ||
    name.includes('mobile money') ||
    name.includes('wallet')
  );
}

function isFixedAssetDebitAccount(account) {
  if (!account) return false;
  const t = (account.accountType || account.type || '').toUpperCase();
  const isAsset = t === 'ASSET' || t === 'ASSETS';
  return isAsset && !isCashLikeAccount(account);
}

/**
 * Backfill Asset register rows for historical capital contributions (asset type only).
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} [db]
 */
export async function syncCapitalContributionAssets(tenantId, userId, db = prisma) {
  const transactions = await db.transaction.findMany({
    where: {
      tenantId,
      sourceType: 'capital_contribution',
      status: 'posted',
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      date: true,
      description: true,
      reference: true,
    },
  });

  const results = { created: 0, skipped: 0, errors: [] };

  for (const txn of transactions) {
    const existing = await findAssetByCapitalContribution(tenantId, txn.id, db);
    if (existing) {
      results.skipped += 1;
      continue;
    }

    const audit = await db.auditLog.findFirst({
      where: {
        tenantId,
        action: 'CAPITAL_CONTRIBUTION',
        details: { contains: txn.id },
      },
      orderBy: { createdAt: 'desc' },
    });

    let assetName = null;
    let assetType = null;
    let contributionType = null;
    let amount = null;

    if (audit?.details) {
      try {
        const parsed = JSON.parse(audit.details);
        contributionType = parsed.type;
        assetName = parsed.assetName;
        assetType = parsed.assetType;
        amount = parsed.amount;
      } catch {
        /* fall through */
      }
    }

    const entries = await db.journalEntry.findMany({
      where: { transactionId: txn.id, tenantId },
    });
    const debitEntry = entries.find((e) => (e.debit || 0) > 0);
    if (!debitEntry) {
      results.skipped += 1;
      continue;
    }

    const debitAccount = await db.account.findFirst({
      where: { id: debitEntry.accountId, tenantId },
    });

    if (contributionType === 'cash' || isCashLikeAccount(debitAccount)) {
      results.skipped += 1;
      continue;
    }

    if (contributionType && contributionType !== 'asset' && !isFixedAssetDebitAccount(debitAccount)) {
      results.skipped += 1;
      continue;
    }

    if (!isFixedAssetDebitAccount(debitAccount)) {
      results.skipped += 1;
      continue;
    }

    const parsedAmount = Number(amount ?? debitEntry.debit) || 0;
    if (parsedAmount <= 0) {
      results.skipped += 1;
      continue;
    }

    try {
      await registerAssetFromCapitalContribution(
        {
          tenantId,
          userId,
          transactionId: txn.id,
          reference: txn.reference,
          assetName: assetName || txn.description,
          assetType,
          debitAccount,
          amount: parsedAmount,
          purchaseDate: txn.date,
          description: txn.description,
        },
        db
      );
      results.created += 1;
    } catch (err) {
      results.errors.push({ transactionId: txn.id, message: err.message || String(err) });
    }
  }

  return results;
}
