import prisma from '@/lib/prisma';
import { recalculateAccountBalanceFromPostedGl } from '@/lib/accountBalanceService';
import { resolveAccountMigrationTarget } from './resolveMapping.js';
import { remapAccountForeignKeys } from './remapForeignKeys.js';
import { isCanonicalCode } from './canonicalCodes.js';

/**
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 * @param {string} tenantId
 */
async function buildCodeToAccountId(db, tenantId) {
  const rows = await db.account.findMany({
    where: { tenantId, isActive: true, mergedIntoAccountId: null },
    select: { id: true, accountCode: true },
  });
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const r of rows) {
    if (r.accountCode) map.set(String(r.accountCode).trim(), r.id);
  }
  return map;
}

/**
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 * @param {string} tenantId
 */
async function countActiveChildren(db, tenantId, accountId) {
  return db.account.count({
    where: { tenantId, parentAccountId: accountId, isActive: true },
  });
}

/**
 * CoA consolidation for one tenant (guide Phases 2–5 subset).
 * @param {{ tenantId: string, dryRun?: boolean, migrationBatchId?: string }} opts
 */
export async function migrateCoaTenant(opts) {
  const { tenantId, dryRun = true, migrationBatchId = `coa-${Date.now()}` } = opts;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, coaEquityMigrationApproved: true },
  });
  if (!tenant) {
    return { ok: false, tenantId, error: 'Tenant not found', dryRun };
  }

  const accounts = await prisma.account.findMany({
    where: { tenantId, isActive: true, mergedIntoAccountId: null },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      accountType: true,
      isSystem: true,
    },
  });

  const plan = [];
  const errors = [];

  for (const acc of accounts) {
    const code = (acc.accountCode || '').trim();
    if (!code) {
      errors.push({ accountId: acc.id, message: 'Missing accountCode' });
      continue;
    }
    if (isCanonicalCode(code)) {
      plan.push({ accountId: acc.id, accountCode: code, action: 'skip', reason: 'canonical' });
      continue;
    }

    const resolved = resolveAccountMigrationTarget(acc, {
      equityMigrationApproved: tenant.coaEquityMigrationApproved,
    });
    if (!resolved.ok) {
      errors.push({
        accountId: acc.id,
        accountCode: code,
        code: resolved.code,
        message: resolved.message,
      });
      continue;
    }

    if (resolved.targetCode === code) {
      plan.push({ accountId: acc.id, accountCode: code, action: 'skip', reason: 'same_code' });
      continue;
    }

    plan.push({
      accountId: acc.id,
      accountCode: code,
      action: 'remap',
      targetCode: resolved.targetCode,
      rule: resolved.rule,
    });
  }

  if (errors.length) {
    return {
      ok: false,
      tenantId,
      dryRun,
      migrationBatchId,
      errors,
      plan,
      message: 'Resolve blocking issues before running with dryRun: false.',
    };
  }

  if (dryRun) {
    const remapCount = plan.filter((p) => p.action === 'remap').length;
    return {
      ok: true,
      tenantId,
      dryRun: true,
      migrationBatchId,
      remapCount,
      plan,
    };
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: { coaLocked: true },
      });

      const codeToId = await buildCodeToAccountId(tx, tenantId);

      for (const step of plan) {
        if (step.action !== 'remap') continue;
        const sourceId = step.accountId;
        const targetId = codeToId.get(step.targetCode);
        if (!targetId) {
          throw new Error(`Target canonical account missing for code ${step.targetCode}`);
        }
        if (sourceId === targetId) continue;

        const childCount = await countActiveChildren(tx, tenantId, sourceId);
        if (childCount > 0) {
          throw new Error(
            `Account ${step.accountCode} has ${childCount} active children; re-parent children before migration.`
          );
        }

        await remapAccountForeignKeys(tx, tenantId, sourceId, targetId);

        await recalculateAccountBalanceFromPostedGl(targetId, tenantId, tx);
        await recalculateAccountBalanceFromPostedGl(sourceId, tenantId, tx);

        await tx.account.update({
          where: { id: sourceId },
          data: {
            isActive: false,
            retiredAt: new Date(),
            migratedToAccountCode: step.targetCode,
            acceptsNewTransactions: false,
            visibleInChart: false,
          },
        });

        await tx.coaMigrationLog.create({
          data: {
            tenantId,
            originalAccountId: sourceId,
            originalCode: step.accountCode,
            originalName: accounts.find((a) => a.id === sourceId)?.accountName ?? null,
            originalType: accounts.find((a) => a.id === sourceId)?.accountType ?? null,
            mappedToCode: step.targetCode,
            mappedToName: null,
            status: 'completed',
            migratedAt: new Date(),
            migrationBatchId,
          },
        });
      }

      await tx.tenant.update({
        where: { id: tenantId },
        data: { coaLocked: false },
      });
    },
    { timeout: 300000 }
  );

  return {
    ok: true,
    tenantId,
    dryRun: false,
    migrationBatchId,
    migrated: plan.filter((p) => p.action === 'remap').length,
  };
}
