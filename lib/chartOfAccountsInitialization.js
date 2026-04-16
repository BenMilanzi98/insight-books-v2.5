/**
 * Ensure a baseline Chart of Accounts (CoA) exists for a tenant.
 * Called during tenant registration and POST /api/chart-of-accounts/bootstrap.
 *
 * Uses lib/chartOfAccountsBlueprint.js (aligned with CoA implementation spec).
 * Safe for existing tenants: does not change codes, types, or names on existing rows;
 * may set isSystem, fill empty description/subtype, reparent when reparentSafe and low-risk.
 */

import prisma from './prisma.js';
import { CHART_OF_ACCOUNTS_BLUEPRINT } from './chartOfAccountsBlueprint.js';
import {
  runCanonicalCoaMigrationsPhase1,
  runCanonicalCoaMigrationsPhase2,
} from './chartOfAccountsCanonicalMigration.js';

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];

function normalizeAccountType(value) {
  if (!value) return value;
  const normalized = value.toString().trim();
  if (!normalized) return normalized;
  const upper = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  if (ACCOUNT_TYPES.includes(upper)) return upper;
  return upper;
}

/**
 * @param {import('@prisma/client').PrismaClient} db
 * @param {string} tenantId
 * @param {string[]} codes
 */
async function anyAccountExists(db, tenantId, codes) {
  if (!codes?.length) return false;
  const found = await db.account.findFirst({
    where: { tenantId, accountCode: { in: codes } },
    select: { id: true },
  });
  return Boolean(found);
}

/**
 * @param {import('@prisma/client').PrismaClient} db
 * @param {string} accountId
 */
async function countJournalLines(db, accountId) {
  const [jl, tl] = await Promise.all([
    db.journalEntryLine.count({ where: { accountId } }),
    db.transactionLine.count({ where: { accountId } }),
  ]);
  return jl + tl;
}

async function ensureAccountForTenant(tenantId, blueprint, cache, db = prisma) {
  const accountType = normalizeAccountType(blueprint.type);

  if (blueprint.skipCreateIfAnyCodeExists?.length) {
    const skip = await anyAccountExists(db, tenantId, blueprint.skipCreateIfAnyCodeExists);
    if (skip) return;
  }

  const parentAccountId = blueprint.parentCode
    ? cache.get(blueprint.parentCode) ??
      (
        await db.account.findFirst({
          where: { tenantId, accountCode: blueprint.parentCode },
          select: { id: true },
        })
      )?.id ??
      null
    : null;

  const existing = await db.account.findFirst({
    where: { tenantId, accountCode: blueprint.code },
    select: {
      id: true,
      accountName: true,
      accountType: true,
      parentAccountId: true,
      description: true,
      accountSubtype: true,
      isSystem: true,
    },
  });

  const normalBalance =
    blueprint.normalBalance ||
    (['Asset', 'Expense'].includes(accountType) ? 'Debit' : 'Credit');

  const baseCreate = {
    tenantId,
    accountCode: blueprint.code,
    accountName: blueprint.name,
    accountType,
    normalBalance,
    accountSubtype: blueprint.subtype || null,
    parentAccountId,
    description: blueprint.description || null,
    ...(blueprint.isSystem ? { isSystem: true } : {}),
  };

  if (!existing) {
    const created = await db.account.create({
      data: baseCreate,
      select: { id: true },
    });
    cache.set(blueprint.code, created.id);
    return;
  }

  cache.set(blueprint.code, existing.id);

  const patch = {};
  if (blueprint.isSystem && !existing.isSystem) {
    patch.isSystem = true;
  }
  if (blueprint.description && !existing.description) {
    patch.description = blueprint.description;
  }
  if (blueprint.subtype && !existing.accountSubtype) {
    patch.accountSubtype = blueprint.subtype;
  }

  if (blueprint.reparentSafe && parentAccountId && existing.parentAccountId !== parentAccountId) {
    const lines = await countJournalLines(db, existing.id);
    if (lines === 0) {
      patch.parentAccountId = parentAccountId;
    }
  }

  if (Object.keys(patch).length > 0) {
    await db.account.update({
      where: { id: existing.id },
      data: patch,
    });
  }
}

/**
 * Ensure baseline chart of accounts exists for the tenant.
 * @param {string} tenantId
 * @param {object} tx - optional Prisma transaction client
 */
export async function ensureChartOfAccountsForTenant(tenantId, tx = prisma) {
  if (!tenantId) return;

  await runCanonicalCoaMigrationsPhase1(tenantId, tx);

  const parentCache = new Map();
  for (const blueprint of CHART_OF_ACCOUNTS_BLUEPRINT) {
    await ensureAccountForTenant(tenantId, blueprint, parentCache, tx);
  }

  await runCanonicalCoaMigrationsPhase2(tenantId, tx);
}
