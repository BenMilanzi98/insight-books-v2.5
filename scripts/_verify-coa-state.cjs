require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const r = {
    accounts: await p.account.count(),
    systemCoaDefinition: await p.systemCoaDefinition.count(),
    expenseCategory: await p.expenseCategory.count(),
    coaMigrationLog: await p.coaMigrationLog.count(),
    accountingMappingCorrection: await p.accountingMappingCorrection.count(),
    paymentAccounts: await p.paymentAccount.count(),
    paymentWithCoa: await p.paymentAccount.count({ where: { coaAccountId: { not: null } } }),
  };
  console.log(JSON.stringify(r, null, 2));
  await p.$disconnect();
})();
