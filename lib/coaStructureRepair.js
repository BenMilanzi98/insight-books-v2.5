/**
 * Repair tenant CoA rows: gap-fill blueprint accounts, sync legacy fields, re-parent to blueprint hierarchy.
 */

import prisma from './prisma.js';
import { CHART_OF_ACCOUNTS_BLUEPRINT } from './chartOfAccountsBlueprint.js';
import { accountsForCatchAllDropdown } from './coaSystemStructureTree.js';
import { classifyCoaBucketByCode } from './coaMigration/classifyRange.js';
import { resolveAccountMigrationTarget } from './coaMigration/resolveMapping.js';
import { isCanonicalCode } from './coaMigration/canonicalCodes.js';

const CATCH_ALL_CODES = ['1999', '2999', '3999', '4900', '5900'];

/**
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 * @param {string} tenantId
 */
async function syncLegacyAccountFields(db, tenantId) {
  const rows = await db.account.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, accountCode: true, accountName: true, accountType: true, code: true, name: true, type: true },
  });
  let synced = 0;
  for (const row of rows) {
    const ac = (row.accountCode || '').trim();
    const an = (row.accountName || '').trim();
    const at = (row.accountType || '').trim();
    const patch = {};
    if (ac && row.code !== ac) patch.code = ac;
    if (an && row.name !== an) patch.name = an;
    if (at && row.type !== at) patch.type = at;
    if (Object.keys(patch).length) {
      await db.account.update({ where: { id: row.id }, data: patch });
      synced += 1;
    }
  }
  return synced;
}

/**
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 * @param {string} tenantId
 */
async function reparentAccountsToBlueprint(db, tenantId) {
  const blueprintByCode = new Map(CHART_OF_ACCOUNTS_BLUEPRINT.map((r) => [r.code, r]));
  const accounts = await db.account.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, accountCode: true, parentAccountId: true },
  });
  const idByCode = new Map(
    accounts.filter((a) => a.accountCode).map((a) => [String(a.accountCode).trim(), a.id])
  );

  let reparented = 0;
  for (const acc of accounts) {
    const code = (acc.accountCode || '').trim();
    const bp = blueprintByCode.get(code);
    if (!bp?.parentCode) continue;
    const expectedParentId = idByCode.get(bp.parentCode) ?? null;
    if (expectedParentId && acc.parentAccountId !== expectedParentId) {
      await db.account.update({
        where: { id: acc.id },
        data: { parentAccountId: expectedParentId },
      });
      reparented += 1;
    }
  }
  return reparented;
}

/**
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 * @param {string} tenantId
 */
async function countAccountActivity(db, accountId) {
  const [jel, tl] = await Promise.all([
    db.journalEntryLine.count({ where: { accountId } }),
    db.transactionLine.count({ where: { accountId } }),
  ]);
  return jel + tl;
}

/**
 * Deactivate unused duplicate rows that share a canonical blueprint code with another active row.
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 * @param {string} tenantId
 * @param {boolean} dryRun
 */
async function retireUnusedCodeDuplicates(db, tenantId, dryRun) {
  const accounts = await db.account.findMany({
    where: { tenantId, isActive: true, mergedIntoAccountId: null },
    select: { id: true, accountCode: true, accountName: true, isSystem: true },
  });
  const byCode = new Map();
  for (const a of accounts) {
    const c = (a.accountCode || '').trim();
    if (!c) continue;
    if (!byCode.has(c)) byCode.set(c, []);
    byCode.get(c).push(a);
  }

  const retired = [];
  for (const [code, group] of byCode) {
    if (group.length < 2) continue;
    const canonical = group.find((g) => g.isSystem) ?? group[0];
    for (const dup of group) {
      if (dup.id === canonical.id) continue;
      const activity = await countAccountActivity(db, dup.id);
      if (activity > 0) continue;
      retired.push({ code, id: dup.id, name: dup.accountName, canonicalId: canonical.id });
      if (!dryRun) {
        await db.account.update({
          where: { id: dup.id },
          data: {
            isActive: false,
            mergedIntoAccountId: canonical.id,
            acceptsNewTransactions: false,
            visibleInChart: false,
          },
        });
      }
    }
  }
  return retired;
}

/**
 * @param {string} tenantId
 * @param {{ dryRun?: boolean, tx?: import('@prisma/client').PrismaClient }} [opts]
 */
export async function repairTenantCoaStructure(tenantId, opts = {}) {
  const dryRun = opts.dryRun !== false;
  const db = opts.tx ?? prisma;

  if (!tenantId) {
    return { ok: false, error: 'tenantId required' };
  }

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, coaEquityMigrationApproved: true },
  });
  if (!tenant) return { ok: false, error: 'Tenant not found' };

  const beforeAccounts = await db.account.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, accountCode: true, accountName: true, accountType: true },
  });

  const catchAllBefore = {};
  for (const cc of CATCH_ALL_CODES) {
    catchAllBefore[cc] = accountsForCatchAllDropdown(beforeAccounts, cc).map((a) => ({
      code: a.accountCode,
      name: a.accountName,
    }));
  }

  const miscoded = [];
  for (const a of beforeAccounts) {
    const code = (a.accountCode || '').trim();
    if (!code || isCanonicalCode(code)) continue;
    const bucket = classifyCoaBucketByCode(code);
    if (bucket === 'UNCLASSIFIED') continue;
    const resolved = resolveAccountMigrationTarget(
      { accountCode: code, accountName: a.accountName, accountType: a.accountType },
      { equityMigrationApproved: tenant.coaEquityMigrationApproved }
    );
    if (resolved.ok && resolved.targetCode !== code && resolved.rule === 'semantic') {
      miscoded.push({
        id: a.id,
        from: code,
        to: resolved.targetCode,
        name: a.accountName,
        rule: resolved.rule,
      });
    }
  }

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      tenantId,
      catchAllBefore,
      miscoded,
      summary: {
        catchAll5900: catchAllBefore['5900']?.length ?? 0,
        catchAll2999: catchAllBefore['2999']?.length ?? 0,
      },
    };
  }

  const synced = await syncLegacyAccountFields(db, tenantId);
  const reparented = await reparentAccountsToBlueprint(db, tenantId);
  const retiredDuplicates = await retireUnusedCodeDuplicates(db, tenantId, false);

  const afterAccounts = await db.account.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, accountCode: true, accountName: true, accountType: true },
  });
  const catchAllAfter = {};
  for (const cc of CATCH_ALL_CODES) {
    catchAllAfter[cc] = accountsForCatchAllDropdown(afterAccounts, cc).length;
  }

  return {
    ok: true,
    dryRun: false,
    tenantId,
    synced,
    reparented,
    retiredDuplicates,
    catchAllAfter,
    miscoded,
  };
}
