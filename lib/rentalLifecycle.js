import { ACTIVE_RENTAL_STATUSES } from '@/lib/rentalAvailability';
import { shouldAutoCompleteExpiredRentals } from '@/lib/rentalBookingPolicy';

/**
 * Auto-complete past-end bookings (unsafe vs inspection). Gated by tenant/env policy.
 * Prefer markOverdueRentals for default behaviour.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} [tenantId]
 * @param {{ force?: boolean, settings?: { rentalAutoCompleteExpired?: boolean|null } }} [opts]
 */
export async function releaseExpiredRentals(prisma, tenantId = null, opts = {}) {
  if (!opts.force) {
    let settings = opts.settings;
    if (!settings && tenantId) {
      settings = await prisma.tenantSettings.findFirst({
        where: { tenantId },
        select: { rentalAutoCompleteExpired: true },
      });
    }
    if (!shouldAutoCompleteExpiredRentals(settings)) {
      // Safe default: only flag overdue; do not free capacity without explicit complete/return
      const overdue = await markOverdueRentals(prisma, tenantId);
      return { releasedCount: 0, overdueCount: overdue.overdueCount, gated: true };
    }
  }

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

  return { releasedCount: ids.length, gated: false };
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
