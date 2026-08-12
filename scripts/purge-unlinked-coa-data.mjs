#!/usr/bin/env node
/**
 * Purge data that is not linked to Chart of Accounts (Account table).
 *
 * Fresh-books CoA SoT cleanup:
 *  - Wipe legacy Transaction archive + string-keyed AccountBalance caches
 *  - Auto-link PaymentAccount → Account when possible; deactivate/delete the rest
 *  - Remove ExpenseCategory / TaxType / mappings / product FKs that point at missing Accounts
 *  - Clear orphan GL FKs on Expense / Liability / Asset / RecurringExpense
 *  - Zero Account.balance cache
 *
 * Usage:
 *   node --import ./scripts/registerAliasLoader.mjs scripts/purge-unlinked-coa-data.mjs --dry-run
 *   node --import ./scripts/registerAliasLoader.mjs scripts/purge-unlinked-coa-data.mjs --confirm
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--confirm');
const DRY = !APPLY;

function countOrZero(fn) {
  return fn().catch(() => 0);
}

async function accountIdsForTenant(tenantId) {
  const rows = await prisma.account.findMany({
    where: { tenantId },
    select: { id: true, accountCode: true, accountName: true, accountType: true, parentAccountId: true },
  });
  return rows;
}

async function resolveCashLikeAccount(accounts, paymentAccount) {
  const type = String(paymentAccount.accountType || '').toLowerCase();
  const name = String(paymentAccount.name || '').toLowerCase();
  const byCode = (code) => accounts.find((a) => String(a.accountCode) === code);

  const preferLeaf = (parentCode) => {
    const parent = byCode(parentCode);
    if (!parent) return null;
    const child = accounts.find((a) => a.parentAccountId === parent.id);
    return child || parent;
  };

  if (type.includes('cash') || name === 'cash' || name.includes('cash on hand')) {
    return byCode('1110') || preferLeaf('1100') || byCode('1010');
  }
  if (type.includes('petty')) {
    return byCode('1110') || preferLeaf('1100');
  }
  if (type.includes('bank') || type.includes('cheque')) {
    return preferLeaf('1130') || byCode('1131') || byCode('1130');
  }
  if (type.includes('mobile') || type.includes('wallet') || name.includes('airtel') || name.includes('tnm')) {
    return preferLeaf('1140') || byCode('1141') || byCode('1140');
  }
  if (type.includes('pos')) {
    return preferLeaf('1130') || byCode('1131') || byCode('1110');
  }
  return byCode('1110') || preferLeaf('1130');
}

async function main() {
  if (!APPLY && !process.argv.includes('--dry-run')) {
    console.error('Refusing to run. Pass --dry-run or --confirm.');
    process.exitCode = 1;
    return;
  }

  console.log(DRY ? 'DRY-RUN — no writes' : 'APPLY — purging unlinked data');

  const before = {
    transactions: await countOrZero(() => prisma.transaction.count()),
    transactionLines: await countOrZero(() => prisma.transactionLine.count()),
    accountBalances: await countOrZero(() => prisma.accountBalance.count()),
    accountBalanceHistory: await countOrZero(() => prisma.accountBalanceHistory.count()),
    paymentAccountsUnlinked: await countOrZero(() =>
      prisma.paymentAccount.count({ where: { OR: [{ coaAccountId: null }, { coaAccountId: '' }] } })
    ),
  };
  console.log('Before:', before);

  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  const summary = {
    paymentLinked: 0,
    paymentDeactivated: 0,
    paymentDeleted: 0,
    expenseCategoriesDeleted: 0,
    taxTypesDeactivated: 0,
    productFksCleared: 0,
    expenseFksCleared: 0,
    liabilityFksCleared: 0,
    assetFksCleared: 0,
    recurringFksCleared: 0,
    mappingsDeleted: 0,
    transactionsDeleted: 0,
    balancesDeleted: 0,
  };

  // ── Per-tenant CoA-link cleanup ──────────────────────────────────────────
  for (const tenant of tenants) {
    const accounts = await accountIdsForTenant(tenant.id);
    const accountIdSet = new Set(accounts.map((a) => a.id));

    // PaymentAccount: link or remove
    const paymentAccounts = await prisma.paymentAccount.findMany({
      where: { tenantId: tenant.id },
    });
    for (const pa of paymentAccounts) {
      const linkedOk = pa.coaAccountId && accountIdSet.has(pa.coaAccountId);
      if (linkedOk) continue;

      const resolved = await resolveCashLikeAccount(accounts, pa);
      if (resolved) {
        summary.paymentLinked += 1;
        if (!DRY) {
          await prisma.paymentAccount.update({
            where: { id: pa.id },
            data: { coaAccountId: resolved.id },
          });
        }
        console.log(`  [${tenant.name}] PaymentAccount ${pa.name} → ${resolved.accountCode}`);
        continue;
      }

      if (pa.isSystem) {
        summary.paymentDeactivated += 1;
        if (!DRY) {
          await prisma.paymentAccount.update({
            where: { id: pa.id },
            data: { isActive: false, coaAccountId: null },
          });
        }
        console.log(`  [${tenant.name}] deactivated system PaymentAccount (no CoA): ${pa.name}`);
        continue;
      }

      // Non-system unlinked: delete if no allocations; else deactivate
      const allocCount = await prisma.paymentAllocation.count({ where: { paymentAccountId: pa.id } }).catch(() => 0);
      const depositCount = await prisma.posCashDayDeposit.count({ where: { toAccountId: pa.id } }).catch(() => 0);
      if (allocCount === 0 && depositCount === 0) {
        summary.paymentDeleted += 1;
        if (!DRY) {
          await prisma.paymentAccount.delete({ where: { id: pa.id } }).catch(async () => {
            await prisma.paymentAccount.update({
              where: { id: pa.id },
              data: { isActive: false, coaAccountId: null },
            });
            summary.paymentDeleted -= 1;
            summary.paymentDeactivated += 1;
          });
        }
        console.log(`  [${tenant.name}] deleted PaymentAccount (no CoA): ${pa.name}`);
      } else {
        summary.paymentDeactivated += 1;
        if (!DRY) {
          await prisma.paymentAccount.update({
            where: { id: pa.id },
            data: { isActive: false },
          });
        }
        console.log(`  [${tenant.name}] deactivated PaymentAccount (in use, no CoA): ${pa.name}`);
      }
    }

    // ExpenseCategory orphan accountId
    const categories = await prisma.expenseCategory.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true, accountId: true },
    });
    for (const cat of categories) {
      if (cat.accountId && accountIdSet.has(cat.accountId)) continue;
      summary.expenseCategoriesDeleted += 1;
      if (!DRY) {
        // Detach expenses first if needed
        await prisma.expense.updateMany({
          where: { tenantId: tenant.id, categoryId: cat.id },
          data: { categoryId: null },
        }).catch(() => {});
        await prisma.expenseCategory.delete({ where: { id: cat.id } }).catch(() => {});
      }
      console.log(`  [${tenant.name}] deleted ExpenseCategory (no CoA): ${cat.name}`);
    }

    // TaxType orphan → deactivate
    const taxTypes = await prisma.taxType.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, taxName: true, accountId: true, status: true },
    });
    for (const tt of taxTypes) {
      if (tt.accountId && accountIdSet.has(tt.accountId)) continue;
      summary.taxTypesDeactivated += 1;
      if (!DRY) {
        await prisma.taxType.update({
          where: { id: tt.id },
          data: { status: 'Inactive' },
        });
      }
      console.log(`  [${tenant.name}] deactivated TaxType (no CoA): ${tt.taxName}`);
    }

    // Product orphan FKs → clear
    const products = await prisma.product.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        incomeAccountId: true,
        cogsAccountId: true,
        inventoryAccountId: true,
      },
    });
    for (const p of products) {
      const data = {};
      if (p.incomeAccountId && !accountIdSet.has(p.incomeAccountId)) data.incomeAccountId = null;
      if (p.cogsAccountId && !accountIdSet.has(p.cogsAccountId)) data.cogsAccountId = null;
      if (p.inventoryAccountId && !accountIdSet.has(p.inventoryAccountId)) data.inventoryAccountId = null;
      if (Object.keys(data).length) {
        summary.productFksCleared += 1;
        if (!DRY) await prisma.product.update({ where: { id: p.id }, data });
      }
    }

    // Expense orphan expenseAccountId
    const orphanExpenses = await prisma.expense.findMany({
      where: {
        tenantId: tenant.id,
        expenseAccountId: { not: null },
      },
      select: { id: true, expenseAccountId: true },
    });
    for (const e of orphanExpenses) {
      if (accountIdSet.has(e.expenseAccountId)) continue;
      summary.expenseFksCleared += 1;
      if (!DRY) {
        await prisma.expense.update({
          where: { id: e.id },
          data: { expenseAccountId: null },
        });
      }
    }

    // Liability / Asset orphan glAccountId
    const liabilities = await prisma.liability.findMany({
      where: { tenantId: tenant.id, glAccountId: { not: null } },
      select: { id: true, glAccountId: true },
    });
    for (const row of liabilities) {
      if (accountIdSet.has(row.glAccountId)) continue;
      summary.liabilityFksCleared += 1;
      if (!DRY) {
        await prisma.liability.update({ where: { id: row.id }, data: { glAccountId: null } });
      }
    }

    const assets = await prisma.asset.findMany({
      where: { tenantId: tenant.id, glAccountId: { not: null } },
      select: { id: true, glAccountId: true },
    });
    for (const row of assets) {
      if (accountIdSet.has(row.glAccountId)) continue;
      summary.assetFksCleared += 1;
      if (!DRY) {
        await prisma.asset.update({ where: { id: row.id }, data: { glAccountId: null } });
      }
    }

    const recurring = await prisma.recurringExpense.findMany({
      where: { tenantId: tenant.id, expenseAccountId: { not: null } },
      select: { id: true, expenseAccountId: true },
    });
    for (const row of recurring) {
      if (accountIdSet.has(row.expenseAccountId)) continue;
      summary.recurringFksCleared += 1;
      if (!DRY) {
        await prisma.recurringExpense.update({
          where: { id: row.id },
          data: { expenseAccountId: null },
        });
      }
    }

    // CoaV2 mappings pointing at missing accounts
    const mappings = await prisma.coaV2AccountMapping.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, purpose: true, accountId: true },
    });
    for (const m of mappings) {
      if (accountIdSet.has(m.accountId)) continue;
      summary.mappingsDeleted += 1;
      if (!DRY) {
        await prisma.coaV2AccountMapping.delete({ where: { id: m.id } });
      }
      console.log(`  [${tenant.name}] deleted CoaV2 mapping ${m.purpose} (orphan account)`);
    }
  }

  // ── Global legacy / non-CoA financial caches ─────────────────────────────
  if (!DRY) {
    await prisma.$transaction(async (tx) => {
      // Transaction archive (not V2 SoT; lines may reference accounts but stack is retired)
      try {
        await tx.transactionLine.deleteMany({});
      } catch {
        /* optional model */
      }
      const txDel = await tx.transaction.deleteMany({});
      summary.transactionsDeleted = txDel.count;

      const balDel = await tx.accountBalance.deleteMany({});
      summary.balancesDeleted = balDel.count;
      await tx.accountBalanceHistory.deleteMany({}).catch(() => {});

      await tx.account.updateMany({ data: { balance: 0 } });
    });
  } else {
    summary.transactionsDeleted = before.transactions;
    summary.balancesDeleted = before.accountBalances;
  }

  const after = {
    transactions: await countOrZero(() => prisma.transaction.count()),
    accountBalances: await countOrZero(() => prisma.accountBalance.count()),
    paymentAccountsUnlinkedActive: await countOrZero(() =>
      prisma.paymentAccount.count({
        where: { isActive: true, OR: [{ coaAccountId: null }, { coaAccountId: '' }] },
      })
    ),
  };

  console.log('\nSummary:', summary);
  console.log('After:', after);
  if (DRY) console.log('\nRe-run with --confirm to apply.');
  else console.log('\nDone. All remaining active payment/config rows should link to Account.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
