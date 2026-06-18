require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const t = await p.tenant.findFirst();
  const operating = await p.account.findMany({
    where: {
      tenantId: t.id,
      accountType: 'Expense',
      accountCode: { gte: '5200', lte: '5699' },
    },
    select: { accountCode: true, accountName: true, isActive: true },
    orderBy: { accountCode: 'asc' },
  });
  const a5200 = await p.account.findFirst({ where: { tenantId: t.id, accountCode: '5200' } });
  const a5301 = await p.account.findFirst({ where: { tenantId: t.id, accountCode: '5301' } });
  const a5350 = await p.account.findFirst({ where: { tenantId: t.id, accountCode: '5350' } });
  console.log(JSON.stringify({ a5200, a5301, a5350, operating }, null, 2));
  await p.$disconnect();
})();
