import { ACTIVE_RENTAL_STATUSES } from '@/lib/rentalAvailability';

/**
 * Auto-complete rentals whose end time has passed: operational cleanup + frees calendar capacity.
 * Marks transaction completed and removes availability rows (same as manual complete).
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} [tenantId] optional scope
 */
export async function releaseExpiredRentals(prisma, tenantId = null) {
  const now = new Date();
  const where = {
    endAt: { lt: now },
    status: { in: ACTIVE_RENTAL_STATUSES },
    ...(tenantId ? { tenantId } : {}),
  };

  const ids = (
    await prisma.rentalTransaction.findMany({
      where,
      select: { id: true },
      take: 500,
    })
  ).map((r) => r.id);

  for (const id of ids) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.rentalAssetAvailability.deleteMany({ where: { rentalTransactionId: id } });
        await tx.rentalTransaction.update({
          where: { id },
          data: { status: 'completed' },
        });
      });
    } catch (e) {
      console.warn('[rentalLifecycle] releaseExpiredRentals skip', id, e?.message);
    }
  }

  return { releasedCount: ids.length };
}

/**
 * Mark active bookings as overdue when past end and not completed (for dashboards / alerts).
 */
export async function markOverdueRentals(prisma, tenantId = null) {
  const now = new Date();
  const res = await prisma.rentalTransaction.updateMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      endAt: { lt: now },
      status: { in: ['booked', 'active'] },
    },
    data: { status: 'overdue' },
  });
  return { overdueCount: res.count };
}
