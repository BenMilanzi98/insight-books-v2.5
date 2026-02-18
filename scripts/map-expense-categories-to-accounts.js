import prisma from '../lib/prisma.js';

const dryRun = process.argv.includes('--dry-run');

// Expense categories: sequential unique codes 5001-5999 under parent 5000 - Expense
const getNextExpenseCode = async (tenantId) => {
  const accounts = await prisma.account.findMany({
    where: { tenantId, accountType: 'Expense' },
    select: { accountCode: true },
  });

  const usedSet = new Set(
    accounts
      .map((acc) => acc.accountCode)
      .filter(Boolean)
      .map(String)
  );

  for (let code = 5001; code <= 5999; code++) {
    if (!usedSet.has(String(code))) return String(code);
  }
  throw new Error('Expense code range (5001-5999) exhausted');
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
    console.log(`[DRY RUN] Would create expense account ${nextCode} - ${name} (under 5000 - Expense)`);
    return { id: null, accountName: name, accountCode: nextCode };
  }

  const parentExpense = await prisma.account.findFirst({
    where: {
      tenantId,
      isActive: true,
      OR: [{ accountCode: '5000' }, { code: '5000' }],
    },
    select: { id: true },
  });

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
      ...(parentExpense?.id && { parentAccountId: parentExpense.id }),
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
