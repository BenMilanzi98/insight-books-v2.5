/**
 * One-time script: rename chart-of-accounts account with code 5000 from
 * "Cost of goods" / "Cost of Goods Sold" / "COST OF SALES" etc. to "Expense".
 * Run: node scripts/rename-5000-to-expense.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.account.updateMany({
    where: {
      OR: [
        { accountCode: '5000' },
        { code: '5000' }
      ]
    },
    data: {
      accountName: 'Expense',
      name: 'Expense'
    }
  });
  console.log(`Updated ${result.count} account(s) with code 5000 to name "Expense".`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
