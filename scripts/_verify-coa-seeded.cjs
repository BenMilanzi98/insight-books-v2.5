require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const t = await p.tenant.findFirst({ select: { id: true, name: true } });
  const accts = await p.account.findMany({
    where: { tenantId: t.id },
    select: { accountCode: true, isSystem: true, isActive: true, mergedIntoAccountId: true },
    orderBy: { accountCode: 'asc' },
  });
  const sys = await p.systemCoaDefinition.findUnique({
    where: { id: 'default' },
    select: { payload: true },
  });
  console.log(
    JSON.stringify(
      {
        tenant: t.name,
        accountCount: accts.length,
        allSystem: accts.every((a) => a.isSystem),
        legacy5200: accts.find((a) => a.accountCode === '5200'),
        salaries5301: accts.find((a) => a.accountCode === '5301'),
        systemPayloadCount: sys?.payload?.accounts?.length ?? 0,
        newCodes: ['1133', '1140', '1218', '1240'].map(
          (c) => accts.find((a) => a.accountCode === c)?.accountCode || null
        ),
      },
      null,
      2
    )
  );
  await p.$disconnect();
})();
