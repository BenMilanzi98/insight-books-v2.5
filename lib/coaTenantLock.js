/**
 * CoA migration / maintenance lock (implementation guide Phase 0).
 * When tenant.coaLocked is true, block structural CoA changes and new postings that create lines on new accounts.
 */
import prisma from '@/lib/prisma';

export class CoaTenantLockedError extends Error {
  constructor(tenantId) {
    super('Chart of accounts is locked for this business (migration or maintenance). Try again later.');
    this.name = 'CoaTenantLockedError';
    this.code = 'COA_TENANT_LOCKED';
    this.tenantId = tenantId;
  }
}

export async function isTenantCoaLocked(tenantId, tx = prisma) {
  if (!tenantId) return false;
  const t = await tx.tenant.findUnique({
    where: { id: tenantId },
    select: { coaLocked: true },
  });
  return Boolean(t?.coaLocked);
}

export async function assertTenantCoaUnlocked(tenantId, tx = prisma) {
  if (await isTenantCoaLocked(tenantId, tx)) {
    throw new CoaTenantLockedError(tenantId);
  }
}
