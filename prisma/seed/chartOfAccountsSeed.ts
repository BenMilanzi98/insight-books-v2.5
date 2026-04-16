import { PrismaClient } from '@prisma/client';
import { ensureChartOfAccountsForTenant } from '../../lib/chartOfAccountsInitialization.js';

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });

  if (!tenants.length) {
    console.info('No tenants found. Seed skipped.');
    return;
  }

  for (const tenant of tenants) {
    console.info(`Seeding chart of accounts for tenant ${tenant.name} (${tenant.id})`);
    await ensureChartOfAccountsForTenant(tenant.id, prisma);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.info('Chart of accounts seed finished.');
  })
  .catch(async (error) => {
    console.error('Failed to seed chart of accounts', error);
    await prisma.$disconnect();
    process.exit(1);
  });
