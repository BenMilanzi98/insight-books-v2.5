require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const t = await p.tenant.findFirst({ select: { id: true, name: true } });
  const banks = await p.account.findMany({
    where: { tenantId: t.id, accountCode: { startsWith: '113' } },
    select: { accountCode: true, accountName: true },
    orderBy: { accountCode: 'asc' },
  });
  const mobile = await p.account.findFirst({
    where: { tenantId: t.id, accountCode: '1140' },
    select: { accountCode: true, accountName: true },
  });
  const retired = await p.account.findMany({
    where: { tenantId: t.id, accountCode: { in: ['1130-01', '1130-02'] } },
  });
  const total = await p.account.count({ where: { tenantId: t.id } });
  console.log(
    JSON.stringify({ tenant: t.name, total, retired: retired.length, mobile, banks }, null, 2)
  );
  await p.$disconnect();
})();
