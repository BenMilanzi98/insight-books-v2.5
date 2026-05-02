const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedUnits() {
  console.log('🌱 Syncing global unit catalog (idempotent, no destructive deletes)...');

  try {
    const { ensureGlobalUnitsCatalog } = await import('../lib/ensureGlobalUnitsCatalog.js');
    await ensureGlobalUnitsCatalog(prisma, { force: true });
    console.log('🎉 Global unit catalog is up to date.');
  } catch (error) {
    console.error('❌ Error syncing units:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  seedUnits()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { seedUnits };
