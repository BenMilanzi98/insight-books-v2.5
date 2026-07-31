import prisma from '@/lib/prisma';
import { parseMoney, addMoney } from '@/lib/money';

/**
 * Idempotent monthly leave accrual.
 * Key: tenantId + employeeId + policyId + YYYY-MM
 */
export async function accrueLeaveForMonth({
  tenantId,
  year,
  month,
  employeeId = null,
  db = prisma,
}) {
  const policies = await db.leavePolicy.findMany({
    where: {
      tenantId,
      isActive: true,
      accrualRate: { not: null, gt: 0 },
    },
  });

  const employees = await db.employee.findMany({
    where: {
      tenantId,
      isActive: true,
      ...(employeeId ? { id: employeeId } : {}),
    },
    select: { id: true },
  });

  const results = [];
  for (const emp of employees) {
    for (const policy of policies) {
      const days = parseMoney(policy.accrualRate);
      if (days <= 0) continue;
      const idempotencyKey = `${emp.id}:${policy.id}:${year}-${String(month).padStart(2, '0')}`;

      const existing = await db.leaveAccrualLedger.findUnique({
        where: {
          tenantId_idempotencyKey: { tenantId, idempotencyKey },
        },
      });
      if (existing) {
        results.push({ employeeId: emp.id, policyId: policy.id, status: 'SKIPPED_IDEMPOTENT' });
        continue;
      }

      await db.$transaction(async (tx) => {
        await tx.leaveAccrualLedger.create({
          data: {
            tenantId,
            employeeId: emp.id,
            leavePolicyId: policy.id,
            year,
            month,
            daysAccrued: days,
            idempotencyKey,
          },
        });

        const balance = await tx.leaveBalance.findUnique({
          where: {
            employeeId_leavePolicyId_year: {
              employeeId: emp.id,
              leavePolicyId: policy.id,
              year,
            },
          },
        });

        if (balance) {
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: {
              allocatedDays: addMoney(parseMoney(balance.allocatedDays), days),
              availableDays: addMoney(parseMoney(balance.availableDays), days),
              lastCalculatedAt: new Date(),
            },
          });
        } else {
          await tx.leaveBalance.create({
            data: {
              employeeId: emp.id,
              leavePolicyId: policy.id,
              tenantId,
              year,
              allocatedDays: days,
              availableDays: days,
              usedDays: 0,
              pendingDays: 0,
              carriedOverDays: 0,
              lastCalculatedAt: new Date(),
            },
          });
        }
      });

      results.push({ employeeId: emp.id, policyId: policy.id, status: 'ACCRUED', days });
    }
  }

  return results;
}
