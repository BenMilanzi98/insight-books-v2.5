const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const checks = [
  { name: 'Expense', model: 'expense', accountField: 'expenseAccountId', expectedType: 'Expense' },
  { name: 'RecurringExpense', model: 'recurringExpense', accountField: 'expenseAccountId', expectedType: 'Expense' },
  { name: 'BudgetItem', model: 'budgetItem', accountField: 'accountId', expectedType: null },
  { name: 'TaxType', model: 'taxType', accountField: 'accountId', expectedType: 'Liability' },
  { name: 'SaleItem', model: 'saleItem', accountField: 'accountId', expectedType: 'Income' },
  { name: 'InvoiceItem', model: 'invoiceItem', accountField: 'accountId', expectedType: 'Income' },
];

async function run() {
  const results = [];

  for (const check of checks) {
    const records = await prisma[check.model].findMany({
      where: {
        OR: [
          { [check.accountField]: null },
          {
            account: {
              isActive: false,
            },
          },
          ...(check.expectedType
            ? [
                {
                  account: {
                    accountType: { not: check.expectedType },
                  },
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        [check.accountField]: true,
        account: {
          select: {
            id: true,
            accountName: true,
            accountCode: true,
            accountType: true,
            isActive: true,
          },
        },
      },
      take: 20,
    });

    const totalMissing = await prisma[check.model].count({
      where: { [check.accountField]: null },
    });

    const totalInactive = await prisma[check.model].count({
      where: {
        account: { isActive: false },
      },
    });

    const totalWrongType = check.expectedType
      ? await prisma[check.model].count({
          where: {
            account: { accountType: { not: check.expectedType } },
          },
        })
      : 0;

    results.push({
      name: check.name,
      expectedType: check.expectedType || 'Any',
      totals: {
        missingAccount: totalMissing,
        inactiveAccount: totalInactive,
        wrongType: totalWrongType,
      },
      sample: records,
    });
  }

  console.log(JSON.stringify(results, null, 2));
}

run()
  .catch((error) => {
    console.error('Audit failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
