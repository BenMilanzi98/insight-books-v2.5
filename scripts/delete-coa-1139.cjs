#!/usr/bin/env node
/** Delete account 1139 First Discount House from all tenants. */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const tenants = await p.tenant.findMany({ select: { id: true, name: true } });
  for (const t of tenants) {
    const acc = await p.account.findFirst({
      where: { tenantId: t.id, accountCode: '1139' },
    });
    if (!acc) {
      console.log(`${t.name}: 1139 not found`);
      continue;
    }
    const fallback = await p.account.findFirst({
      where: { tenantId: t.id, accountCode: '1131' },
    });
    const lines =
      (await p.transactionLine.count({ where: { accountId: acc.id } })) +
      (await p.journalEntryLine.count({ where: { accountId: acc.id } }));
    if (lines > 0) {
      console.error(`${t.name}: cannot delete 1139 — ${lines} GL line(s)`);
      continue;
    }
    if (fallback) {
      await p.paymentAccount.updateMany({
        where: { tenantId: t.id, coaAccountId: acc.id },
        data: { coaAccountId: fallback.id },
      });
    }
    await p.account.delete({ where: { id: acc.id } });
    console.log(`${t.name}: deleted 1139 First Discount House`);
  }
  await p.$disconnect();
})();
