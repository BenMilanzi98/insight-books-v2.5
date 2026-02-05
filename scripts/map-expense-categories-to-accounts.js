import prisma from '../lib/prisma.js';

const dryRun = process.argv.includes('--dry-run');

const getNextExpenseCode = async (tenantId) => {
  const accounts = await prisma.account.findMany({
    where: { tenantId, accountType: 'Expense' },
    select: { accountCode: true },
  });

  const maxCode = accounts
    .map((acc) => parseInt(acc.accountCode, 10))
    .filter((code) => Number.isFinite(code))
    .reduce((max, code) => Math.max(max, code), 5999);

  return String(maxCode + 1);
};

const findOrCreateExpenseAccount = async (tenantId, name) => {
  const existing = await prisma.account.findFirst({
    where: {
      tenantId,
      accountType: 'Expense',
      accountName: { equals: name, mode: 'insensitive' },
    },
  });

  if (existing) return existing;

  const nextCode = await getNextExpenseCode(tenantId);
  if (dryRun) {
    console.log(`[DRY RUN] Would create expense account ${nextCode} - ${name}`);
    return { id: null, accountName: name, accountCode: nextCode };
  }

  return prisma.account.create({
    data: {
      tenantId,
      accountCode: nextCode,
      accountName: name.trim(),
      accountType: 'Expense',
      accountSubtype: 'Operating Expense',
      normalBalance: 'Debit',
      isActive: true,
      isSystem: false,
      balance: 0,
    },
  });
};

const run = async () => {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true },
  });

  for (const tenant of tenants) {
    const categories = await prisma.expense.findMany({
      where: {
        tenantId: tenant.id,
        expenseAccountId: null,
        category: { not: null },
      },
      select: { category: true },
      distinct: ['category'],
    });

    if (categories.length === 0) {
      console.log(`No unmapped expense categories for tenant ${tenant.name || tenant.id}`);
      continue;
    }

    console.log(`Mapping ${categories.length} categories for tenant ${tenant.name || tenant.id}`);

    for (const entry of categories) {
      const categoryName = (entry.category || '').trim();
      if (!categoryName) continue;

      const account = await findOrCreateExpenseAccount(tenant.id, categoryName);
      if (!account?.id) continue;

      if (dryRun) {
        console.log(`[DRY RUN] Would map expenses for "${categoryName}" to account ${account.id}`);
        continue;
      }

      await prisma.expense.updateMany({
        where: {
          tenantId: tenant.id,
          expenseAccountId: null,
          category: categoryName,
        },
        data: {
          expenseAccountId: account.id,
          category: account.accountName,
        },
      });

      await prisma.budgetItem.updateMany({
        where: {
          budget: { tenantId: tenant.id },
          accountId: null,
          category: categoryName,
        },
        data: {
          accountId: account.id,
          category: account.accountName,
        },
      });
    }
  }
};

run()
  .then(() => {
    console.log('✅ Category mapping complete');
  })
  .catch((error) => {
    console.error('❌ Category mapping failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
