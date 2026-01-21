import { PrismaClient } from '@prisma/client';

// To avoid multiple instances of Prisma Client in development
const globalForPrisma = global;

function getPrismaClient() {
  // Use singleton pattern to avoid multiple instances
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }
  
  return globalForPrisma.prisma;
}

export const prisma = getPrismaClient();
export default prisma;
