import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Skip DB integration tests when the seeded tenant row is absent (CI / fresh clones).
 */
export async function tenantExistsForIntegration(tenantId) {
  try {
    const row = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    return Boolean(row);
  } catch {
    return false;
  } finally {
    await prisma.$disconnect();
  }
}
