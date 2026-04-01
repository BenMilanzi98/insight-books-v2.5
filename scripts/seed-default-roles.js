import prisma from '../lib/prisma.js';
import { seedDefaultRolesForTenant } from '../lib/seedTenantRoles.js';

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  console.log(`Seeding default roles for ${tenants.length} tenant(s)...`);

  for (const t of tenants) {
    try {
      await seedDefaultRolesForTenant(t.id, prisma);
      console.log(`✓ Seeded roles for tenant: ${t.name} (${t.id})`);
    } catch (e) {
      console.error(`✗ Failed for tenant ${t.name} (${t.id}):`, e?.message || e);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

