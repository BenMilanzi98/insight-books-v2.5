import { PrismaClient } from '@prisma/client';

/**
 * Ephemeral dual-tenant fixture for live IDOR tests.
 * Cascade-deletes tax/reversal rows when tenants are removed.
 */
export async function createDualTenantFixture(prisma = new PrismaClient()) {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const tenantA = await prisma.tenant.create({
    data: {
      name: `IDOR A ${suffix}`,
      subdomain: `idor-a-${suffix}`,
      subscriptionPlan: 'trial',
      status: 'active',
    },
  });
  const tenantB = await prisma.tenant.create({
    data: {
      name: `IDOR B ${suffix}`,
      subdomain: `idor-b-${suffix}`,
      subscriptionPlan: 'trial',
      status: 'active',
    },
  });

  const accountA = await prisma.account.create({
    data: {
      tenantId: tenantA.id,
      code: '2041',
      name: 'VAT Payable A',
      type: 'Liability',
      accountCode: '2041',
      accountName: 'VAT Payable A',
      accountType: 'Liability',
      isActive: true,
    },
  });
  const accountB = await prisma.account.create({
    data: {
      tenantId: tenantB.id,
      code: '2041',
      name: 'VAT Payable B',
      type: 'Liability',
      accountCode: '2041',
      accountName: 'VAT Payable B',
      accountType: 'Liability',
      isActive: true,
    },
  });

  return {
    prisma,
    tenantA,
    tenantB,
    accountA,
    accountB,
    userA: { id: `idor-user-a-${suffix}`, tenantId: tenantA.id },
    userB: { id: `idor-user-b-${suffix}`, tenantId: tenantB.id },
    async cleanup() {
      await prisma.tenant.deleteMany({
        where: { id: { in: [tenantA.id, tenantB.id] } },
      });
      await prisma.$disconnect();
    },
  };
}

export function dbReadyForIdor() {
  return Boolean(process.env.DATABASE_URL);
}
