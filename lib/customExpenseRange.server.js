/**
 * Server-only: ensure **5700** exists and pick the next **5701–5899** code.
 */
import prisma from '@/lib/prisma';
import { ensureChartOfAccountsForTenant } from '@/lib/chartOfAccountsInitialization';
import {
  CUSTOM_EXPENSE_HEADER_CODE,
  computeNextCustomExpenseCode,
} from '@/lib/customExpenseRange.js';

/**
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient} [db]
 */
export async function ensureCustomExpenses5700ForTenant(tenantId, db = prisma) {
  let row = await db.account.findFirst({
    where: { tenantId, accountCode: CUSTOM_EXPENSE_HEADER_CODE },
    select: { id: true, accountCode: true, accountType: true, tenantId: true },
  });
  if (row) return row;
  await ensureChartOfAccountsForTenant(tenantId, db);
  row = await db.account.findFirst({
    where: { tenantId, accountCode: CUSTOM_EXPENSE_HEADER_CODE },
    select: { id: true, accountCode: true, accountType: true, tenantId: true },
  });
  return row;
}

/**
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient} [db]
 * @returns {Promise<string|null>}
 */
export async function assignNextCustomExpenseAccountCode(tenantId, db = prisma) {
  const rows = await db.account.findMany({
    where: { tenantId },
    select: { accountCode: true },
  });
  const used = new Set(
    rows
      .map((r) => String(r.accountCode || '').trim())
      .filter((c) => /^\d{4}$/.test(c))
      .filter((c) => {
        const n = parseInt(c, 10);
        return n >= 5701 && n <= 5899;
      })
  );
  return computeNextCustomExpenseCode(used);
}
