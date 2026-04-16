import type { PrismaClient } from '@prisma/client';

/**
 * Ensures baseline CoA rows exist for the tenant (see chartOfAccountsBlueprint).
 * `tx` is the Prisma client or an interactive transaction client from `$transaction`.
 */
export declare function ensureChartOfAccountsForTenant(
  tenantId: string,
  tx?: PrismaClient
): Promise<void>;
