/**
 * Apply validated system CoA payload to one tenant or all tenants.
 * Preserves account rows and codes; sets mergedIntoAccountId for logical merges.
 */

import {
  normalizeAccountType,
  sortAccountsForApply,
} from '@/lib/systemCoaPayload';
import { isCoaStructuralRootCode } from '@/lib/coaPostingCodes.js';

function defaultNormalBalance(accountType) {
  const t = normalizeAccountType(accountType);
  return t === 'Asset' || t === 'Expense' ? 'Debit' : 'Credit';
}

/**
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 * @param {string} tenantId
 * @param {object} payload validated system CoA payload
 */
export async function applySystemCoaPayloadToTenant(db, tenantId, payload) {
  const accounts = payload.accounts || [];
  const merges = payload.merges || [];
  const deactivatedCodes = new Set(payload.deactivatedCodes || []);
  const mergeSources = new Set(merges.map((m) => m.sourceCode));
  const codesInPayload = new Set(accounts.map((a) => a.code));

  await db.account.updateMany({
    where: { tenantId, accountCode: { in: [...codesInPayload] } },
    data: { mergedIntoAccountId: null },
  });

  const sorted = sortAccountsForApply(accounts);
  const codeToId = new Map();

  const existingRows = await db.account.findMany({
    where: { tenantId, accountCode: { in: [...codesInPayload] } },
    select: { id: true, accountCode: true },
  });
  for (const r of existingRows) {
    codeToId.set(r.accountCode, r.id);
  }

  for (const row of sorted) {
    const accountType = normalizeAccountType(row.type);
    const normalBalance = row.normalBalance || defaultNormalBalance(accountType);
    const parentAccountId = row.parentCode
      ? codeToId.get(row.parentCode) ?? null
      : null;

    const existing = await db.account.findFirst({
      where: { tenantId, accountCode: row.code },
      select: { id: true, isSystem: true, balance: true },
    });

    const baseData = {
      accountName: row.name,
      accountType,
      normalBalance,
      accountSubtype: row.subtype || null,
      parentAccountId,
      description: row.description || null,
      name: row.name,
      code: row.code,
      type: accountType,
      ...(row.requiresReclassification != null
        ? { requiresReclassification: Boolean(row.requiresReclassification) }
        : {}),
      ...(isCoaStructuralRootCode(row.code) && !row.parentCode
        ? { acceptsNewTransactions: false }
        : {}),
    };

    const isMergeSource = mergeSources.has(row.code);
    const isDeactivated = deactivatedCodes.has(row.code);
    const isActive = !isMergeSource && !isDeactivated;

    if (existing) {
      await db.account.update({
        where: { id: existing.id },
        data: {
          ...baseData,
          ...(row.isSystem ? { isSystem: true } : {}),
          isActive,
        },
      });
      codeToId.set(row.code, existing.id);
    } else {
      const created = await db.account.create({
        data: {
          tenantId,
          accountCode: row.code,
          ...baseData,
          isSystem: Boolean(row.isSystem),
          isActive,
          balance: 0,
        },
      });
      codeToId.set(row.code, created.id);
    }
  }

  for (const m of merges) {
    const sourceId = codeToId.get(m.sourceCode);
    const targetId = codeToId.get(m.targetCode);
    if (!sourceId || !targetId || sourceId === targetId) continue;
    await db.account.update({
      where: { id: sourceId },
      data: {
        mergedIntoAccountId: targetId,
        isActive: false,
      },
    });
  }
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} payload
 * @returns {Promise<{ tenantCount: number, successCount: number, failures: { tenantId: string, message: string }[] }>}
 */
export async function applySystemCoaPayloadToAllTenants(prisma, payload) {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  const failures = [];
  let successCount = 0;

  for (const t of tenants) {
    try {
      await prisma.$transaction(
        async (tx) => {
          await applySystemCoaPayloadToTenant(tx, t.id, payload);
        },
        { timeout: 120000 }
      );
      successCount += 1;
    } catch (e) {
      failures.push({ tenantId: t.id, message: e?.message || String(e) });
    }
  }

  return { tenantCount: tenants.length, successCount, failures };
}
