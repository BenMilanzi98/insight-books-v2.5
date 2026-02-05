import prisma from '@/lib/prisma';

/**
 * The first (oldest) branch for a tenant is treated as the free branch.
 */
export async function getFreeBranchId(tenantId) {
  const first = await prisma.branch.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return first?.id || null;
}

export async function hasActiveBranchSubscription(tenantId, branchId) {
  const now = new Date();
  
  // Check for active PAID subscription
  const paidSub = await prisma.branchSubscription.findFirst({
    where: {
      tenantId,
      branchId,
      isActive: true,
      expiresAt: { gt: now },
      amount: { gt: 0 },
      status: { in: ['Completed', 'Active'] },
    },
    select: { id: true },
  });
  
  if (paidSub) return true;
  
  // Check for active TRIAL subscription
  const trialSub = await prisma.branchSubscription.findFirst({
    where: {
      tenantId,
      branchId,
      isActive: true,
      expiresAt: { gt: now },
      amount: 0,
      status: { in: ['Completed', 'Active', 'Trial'] },
      plan: 'trial',
    },
    select: { id: true },
  });
  
  return Boolean(trialSub);
}

/**
 * Auto-deactivate any non-free branches that do not have an active subscription.
 * Returns list of branchIds deactivated.
 */
export async function syncBranchActiveStatus(tenantId) {
  const freeBranchId = await getFreeBranchId(tenantId);
  const activeBranches = await prisma.branch.findMany({
    where: {
      tenantId,
      isActive: true,
      ...(freeBranchId ? { id: { not: freeBranchId } } : {}),
    },
    select: { id: true },
  });

  if (activeBranches.length === 0) return [];

  const activeBranchIds = activeBranches.map((b) => b.id);
  const now = new Date();

  // Check for active PAID subscriptions
  const paidSubscribed = await prisma.branchSubscription.findMany({
    where: {
      tenantId,
      branchId: { in: activeBranchIds },
      isActive: true,
      expiresAt: { gt: now },
      amount: { gt: 0 },
      status: { in: ['Completed', 'Active'] },
    },
    select: { branchId: true },
  });

  // Check for active TRIAL subscriptions
  const trialSubscribed = await prisma.branchSubscription.findMany({
    where: {
      tenantId,
      branchId: { in: activeBranchIds },
      isActive: true,
      expiresAt: { gt: now },
      amount: 0,
      status: { in: ['Completed', 'Active', 'Trial'] },
      plan: 'trial',
    },
    select: { branchId: true },
  });

  const subscribedSet = new Set([
    ...paidSubscribed.map((s) => s.branchId),
    ...trialSubscribed.map((s) => s.branchId),
  ]);
  
  const toDeactivate = activeBranchIds.filter((id) => !subscribedSet.has(id));
  if (toDeactivate.length === 0) return [];

  await prisma.branch.updateMany({
    where: { tenantId, id: { in: toDeactivate } },
    data: { isActive: false },
  });

  return toDeactivate;
}

