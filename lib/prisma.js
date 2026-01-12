import { PrismaClient } from '@prisma/client';

// To avoid multiple instances of Prisma Client in development
const globalForPrisma = global;

function getPrismaClient() {
  // Check if we need to recreate the client (e.g., after schema changes)
  if (process.env.NODE_ENV !== 'production') {
    // In development, recreate client if it doesn't have the latest models
    if (!globalForPrisma.prisma || !globalForPrisma.prisma.supplierBillItem) {
      if (globalForPrisma.prisma) {
        globalForPrisma.prisma.$disconnect().catch(() => {});
      }
      console.log('Creating new Prisma Client instance...');
      globalForPrisma.prisma = new PrismaClient();
    }
  } else {
    // Production: use singleton
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = new PrismaClient();
    }
  }
  
  return globalForPrisma.prisma;
}

export const prisma = getPrismaClient();
export default prisma;
