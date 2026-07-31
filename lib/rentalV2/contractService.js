import prisma from '@/lib/prisma';
import { addMoney, parseMoney } from '@/lib/money';
import { isQuantityPoolKind } from '@/lib/rentalKinds';
import { makeDocNumber } from './numbering.js';
import { priceRentalLine, pickActiveRatePlan } from './pricing.js';
import { assertContractCommand, CONTRACT_STATUS } from './contractState.js';
import { assertPoolCapacity, assertUnitAvailable } from './allocation.js';

const contractInclude = {
  lines: true,
  deposits: true,
  dispatches: { include: { lines: true } },
  returns: { include: { lines: true, inspections: true } },
  charges: true,
  billingPeriods: true,
  allocations: true,
};

export async function listContracts({ tenantId, status, clientId, take = 50 }) {
  return prisma.rentalContract.findMany({
    where: {
      tenantId,
      ...(status ? { status } : {}),
      ...(clientId ? { clientId } : {}),
    },
    include: { lines: true, deposits: true },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function getContract({ tenantId, contractId }) {
  const contract = await prisma.rentalContract.findFirst({
    where: { id: contractId, tenantId },
    include: contractInclude,
  });
  if (!contract) throw new Error('Contract not found');
  return contract;
}

/**
 * Create draft contract with priced lines + optional unit/pool allocations.
 */
export async function createContract({
  tenantId,
  userId,
  clientId,
  branchId,
  startAt,
  endAt,
  notes,
  quotationId,
  reservationId,
  lines = [],
  mappingSnapshot,
}) {
  if (!clientId) throw new Error('clientId is required');
  if (!startAt || !endAt) throw new Error('startAt and endAt are required');
  if (!Array.isArray(lines) || !lines.length) throw new Error('At least one line is required');

  const start = new Date(startAt);
  const end = new Date(endAt);
  if (!(end > start)) throw new Error('endAt must be after startAt');

  const client = await prisma.client.findFirst({ where: { id: clientId, tenantId } });
  if (!client) throw new Error('Client not found');

  return prisma.$transaction(async (tx) => {
    let subtotal = 0;
    let depositRequired = 0;
    const pricedLines = [];

    for (const raw of lines) {
      const asset = await tx.rentalAsset.findFirst({
        where: { id: raw.rentalAssetId, tenantId },
        include: { ratePlans: true },
      });
      if (!asset) throw new Error(`Rental asset ${raw.rentalAssetId} not found`);

      const plan =
        raw.ratePlanId
          ? asset.ratePlans.find((p) => p.id === raw.ratePlanId)
          : pickActiveRatePlan(asset.ratePlans, start);

      const unitRate = parseMoney(raw.unitRate ?? plan?.baseRate ?? asset.defaultRate);
      const billingUnit = raw.billingUnit || plan?.billingUnit || asset.rateUnit || 'day';
      const qty = Math.max(1, Math.floor(Number(raw.quantity) || 1));
      const minimumCharge = parseMoney(raw.minimumCharge ?? plan?.minimumCharge ?? 0);
      const depositAmount = parseMoney(
        raw.depositAmount ?? plan?.depositAmount ?? asset.defaultDeposit ?? 0
      );

      const priced = priceRentalLine({
        startAt: start,
        endAt: end,
        rateUnit: billingUnit,
        baseRate: unitRate,
        quantity: qty,
        minimumCharge,
        depositAmount,
        taxRatePercent: Number(raw.taxRatePercent) || 0,
      });

      subtotal = addMoney(subtotal, priced.subtotal);
      depositRequired = addMoney(depositRequired, priced.deposit);

      if (raw.rentalUnitId) {
        await assertUnitAvailable(tx, {
          rentalUnitId: raw.rentalUnitId,
          startAt: start,
          endAt: end,
        });
      } else if (isQuantityPoolKind(asset.kind)) {
        await assertPoolCapacity(tx, {
          rentalAssetId: asset.id,
          startAt: start,
          endAt: end,
          quantity: qty,
          capacity: asset.totalQuantity,
        });
      }

      pricedLines.push({
        asset,
        qty,
        unitRate,
        billingUnit,
        minimumCharge,
        depositAmount,
        priced,
        rentalUnitId: raw.rentalUnitId || null,
        description: raw.description || asset.name,
        ratePlanId: plan?.id || null,
        ratePlanVersion: plan?.version || null,
      });
    }

    const contract = await tx.rentalContract.create({
      data: {
        tenantId,
        branchId: branchId || null,
        contractNumber: makeDocNumber('RC'),
        clientId,
        quotationId: quotationId || null,
        reservationId: reservationId || null,
        status: CONTRACT_STATUS.DRAFT,
        startAt: start,
        endAt: end,
        expectedReturnAt: end,
        currency: 'MWK',
        depositRequired,
        subtotalEstimate: subtotal,
        taxEstimate: 0,
        totalEstimate: subtotal,
        pricingSnapshot: { lines: pricedLines.map((l) => l.priced) },
        mappingSnapshot: mappingSnapshot || null,
        notes: notes || null,
        createdById: userId || null,
        lines: {
          create: pricedLines.map((l) => ({
            rentalAssetId: l.asset.id,
            rentalUnitId: l.rentalUnitId,
            quantity: l.qty,
            description: l.description,
            startAt: start,
            endAt: end,
            billingUnit: l.billingUnit,
            unitRate: l.unitRate,
            minimumCharge: l.minimumCharge,
            depositAmount: l.depositAmount,
            lineTotal: l.priced.subtotal,
            ratePlanId: l.ratePlanId,
            ratePlanVersion: l.ratePlanVersion,
            pricingSnapshot: l.priced,
          })),
        },
      },
      include: { lines: true },
    });

    for (const l of pricedLines) {
      await tx.rentalUnitAllocation.create({
        data: {
          tenantId,
          rentalUnitId: l.rentalUnitId,
          rentalAssetId: l.asset.id,
          contractId: contract.id,
          startAt: start,
          endAt: end,
          quantity: l.qty,
          status: 'HELD',
        },
      });
    }

    return tx.rentalContract.findFirst({
      where: { id: contract.id },
      include: contractInclude,
    });
  });
}

export async function transitionContract({ tenantId, contractId, command, userId }) {
  const contract = await getContract({ tenantId, contractId });
  const { nextStatus } = assertContractCommand(contract.status, command);

  const data = {
    status: nextStatus,
    version: { increment: 1 },
  };

  if (String(command).toLowerCase() === 'approve') {
    data.approvedAt = new Date();
    data.approvedById = userId || null;
    if (parseMoney(contract.depositRequired) > 0) {
      data.status = CONTRACT_STATUS.DEPOSIT_PENDING;
    }
  }

  if (String(command).toLowerCase() === 'cancel') {
    await prisma.rentalUnitAllocation.updateMany({
      where: {
        contractId,
        tenantId,
        status: { in: ['HELD', 'CONFIRMED'] },
      },
      data: { status: 'RELEASED' },
    });
  }

  const updated = await prisma.rentalContract.update({
    where: { id: contractId },
    data,
    include: contractInclude,
  });

  if (userId) {
    try {
      await prisma.auditLog.create({
        data: {
          action: `RENTAL_CONTRACT_${String(command).toUpperCase()}`,
          entityType: 'RentalContract',
          entityId: contractId,
          userId,
          tenantId,
          details: JSON.stringify({
            from: contract.status,
            to: updated.status,
            contractNumber: contract.contractNumber,
          }),
        },
      });
    } catch {
      /* optional */
    }
  }

  return updated;
}

export async function updateContractMappings({ tenantId, contractId, mappingSnapshot }) {
  await getContract({ tenantId, contractId });
  return prisma.rentalContract.update({
    where: { id: contractId },
    data: { mappingSnapshot },
    include: contractInclude,
  });
}
