const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const tenantId = 'cms3o1i2700038sg41zc1og7h';
  const subs = await prisma.accountSubscription.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      plan: true,
      isActive: true,
      isTrial: true,
      status: true,
      expiresAt: true,
      createdAt: true,
    },
  });
  console.log('subscriptions', JSON.stringify(subs, null, 2));

  let ent = [];
  try {
    ent = await prisma.mraEisTenantEntitlement.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
  } catch (e) {
    console.log('entitlement query error', e.message);
  }
  console.log(
    'entitlements',
    JSON.stringify(
      ent.map((e) => ({
        id: e.id,
        status: e.status,
        isCurrent: e.isCurrent,
        source: e.entitlementSource,
        sandboxAllowed: e.sandboxAllowed,
        productionAllowed: e.productionAllowed,
      })),
      null,
      2
    )
  );

  const { resolveTenantEisManagementAccess } = await import(
    '../lib/mraEis/navAccess.js'
  ).catch(() => ({ resolveTenantEisManagementAccess: null }));
  if (resolveTenantEisManagementAccess) {
    const access = await resolveTenantEisManagementAccess(tenantId, prisma);
    console.log('managementAccess', access);
  }

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
