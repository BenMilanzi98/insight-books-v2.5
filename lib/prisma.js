import { PrismaClient } from '@prisma/client';

// To avoid multiple instances of Prisma Client in development
const globalForPrisma = global;

/** Models required by platform billing — used to detect a stale generate. */
const REQUIRED_DELEGATES = [
  'platformPlanVersion',
  'platformCredit',
  'platformRefund',
];

function hasRequiredDelegates(client) {
  if (!client) return false;
  if (!REQUIRED_DELEGATES.every((name) => typeof client[name]?.findMany === 'function')) {
    return false;
  }
  // MRA EIS plan fields — reject clients generated before planCategory migration
  try {
    const fields = client._runtimeDataModel?.models?.PlatformPlanVersion?.fields;
    if (Array.isArray(fields) && !fields.some((f) => f.name === 'planCategory')) {
      return false;
    }
  } catch {
    /* older Prisma shapes — skip field probe */
  }
  return true;
}

function getPrismaClient() {
  let client = globalForPrisma.prisma;

  // After `prisma generate` while Next is running, the singleton can keep an old client.
  if (
    client &&
    process.env.NODE_ENV !== 'production' &&
    !hasRequiredDelegates(client)
  ) {
    try {
      client.$disconnect();
    } catch {
      /* ignore */
    }
    globalForPrisma.prisma = undefined;
    client = undefined;
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }

  return globalForPrisma.prisma;
}

export const prisma = getPrismaClient();
export default prisma;
