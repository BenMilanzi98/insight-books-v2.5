import type { PrismaClient } from '@prisma/client';

export interface EnsureChartOfAccountsOptions {
  /** When true (default), use admin `SystemCoaDefinition` if valid; otherwise file blueprint. */
  preferSystemCoaDefinition?: boolean;
}

/**
 * Ensures baseline CoA rows exist for the tenant (system definition or chartOfAccountsBlueprint).
 * `tx` is the Prisma client or an interactive transaction client from `$transaction`.
 */
export declare function ensureChartOfAccountsForTenant(
  tenantId: string,
  tx?: PrismaClient,
  options?: EnsureChartOfAccountsOptions
): Promise<void>;
