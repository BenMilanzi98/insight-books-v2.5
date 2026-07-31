import prisma from '@/lib/prisma';
import { parseMoney } from '@/lib/money';
import { makeDocNumber } from './numbering.js';
import { assertContractCommand, CONTRACT_STATUS } from './contractState.js';
import { getContract } from './contractService.js';

export async function createDispatch({
  tenantId,
  userId,
  contractId,
  dispatchType = 'PICKUP',
  lines = [],
  meterOpening,
  fuelLevel,
  conditionNotes,
  customerAck = false,
  idempotencyKey,
}) {
  const contract = await getContract({ tenantId, contractId });
  if (
    ![
      CONTRACT_STATUS.READY_FOR_DISPATCH,
      CONTRACT_STATUS.APPROVED,
      CONTRACT_STATUS.ACTIVE,
    ].includes(contract.status)
  ) {
    throw new Error(`Cannot dispatch from status ${contract.status}`);
  }

  if (idempotencyKey) {
    const existing = await prisma.rentalDispatch.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      include: { lines: true },
    });
    if (existing) return existing;
  }

  const dispatchLines =
    lines.length > 0
      ? lines
      : contract.lines.map((l) => ({
          rentalAssetId: l.rentalAssetId,
          rentalUnitId: l.rentalUnitId,
          quantity: l.quantity,
        }));

  return prisma.$transaction(async (tx) => {
    const dispatch = await tx.rentalDispatch.create({
      data: {
        tenantId,
        contractId,
        dispatchNumber: makeDocNumber('RD'),
        dispatchType,
        status: 'DISPATCHED',
        meterOpening: meterOpening != null ? parseMoney(meterOpening) : null,
        fuelLevel: fuelLevel || null,
        conditionNotes: conditionNotes || null,
        customerAck: Boolean(customerAck),
        idempotencyKey: idempotencyKey || null,
        createdById: userId || null,
        lines: {
          create: dispatchLines.map((l) => ({
            rentalAssetId: l.rentalAssetId,
            rentalUnitId: l.rentalUnitId || null,
            quantity: Math.max(1, Math.floor(Number(l.quantity) || 1)),
          })),
        },
      },
      include: { lines: true },
    });

    await tx.rentalUnitAllocation.updateMany({
      where: { contractId, tenantId, status: 'HELD' },
      data: { status: 'DISPATCHED' },
    });

    for (const l of dispatchLines) {
      if (l.rentalUnitId) {
        await tx.rentalUnit.updateMany({
          where: { id: l.rentalUnitId, tenantId },
          data: { availabilityStatus: 'ON_RENT' },
        });
      }
    }

    await tx.rentalContract.update({
      where: { id: contractId },
      data: { status: CONTRACT_STATUS.ACTIVE, version: { increment: 1 } },
    });

    return dispatch;
  });
}

export async function createReturn({
  tenantId,
  userId,
  contractId,
  lines = [],
  meterClosing,
  fuelLevel,
  isLate = false,
  lateHours,
  lateFeeAmount,
  lateFeePerDay = 0,
  idempotencyKey,
}) {
  const contract = await getContract({ tenantId, contractId });
  assertContractCommand(contract.status, 'startReturn');

  if (idempotencyKey) {
    const existing = await prisma.rentalReturn.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      include: { lines: true, charges: true },
    });
    if (existing) return existing;
  }

  const returnAt = new Date();
  const expected = new Date(contract.expectedReturnAt || contract.endAt);
  const msLate = Math.max(0, returnAt.getTime() - expected.getTime());
  const computedLateHours = msLate / (1000 * 60 * 60);
  const late = Boolean(isLate) || computedLateHours > 0.01;
  const hours = lateHours != null ? parseMoney(lateHours) : parseMoney(computedLateHours.toFixed(4));
  const daysLate = Math.ceil(Number(hours) / 24);
  let fee = parseMoney(lateFeeAmount);
  if (fee <= 0 && late && parseMoney(lateFeePerDay) > 0 && daysLate > 0) {
    fee = parseMoney(daysLate * parseMoney(lateFeePerDay));
  }

  const returnLines =
    lines.length > 0
      ? lines
      : contract.lines.map((l) => ({
          rentalAssetId: l.rentalAssetId,
          rentalUnitId: l.rentalUnitId,
          quantity: l.quantity,
        }));

  return prisma.$transaction(async (tx) => {
    const ret = await tx.rentalReturn.create({
      data: {
        tenantId,
        contractId,
        returnNumber: makeDocNumber('RR'),
        status: 'RETURNED',
        returnAt,
        meterClosing: meterClosing != null ? parseMoney(meterClosing) : null,
        fuelLevel: fuelLevel || null,
        isLate: late,
        lateHours: late ? hours : null,
        idempotencyKey: idempotencyKey || null,
        createdById: userId || null,
        lines: {
          create: returnLines.map((l) => ({
            rentalAssetId: l.rentalAssetId,
            rentalUnitId: l.rentalUnitId || null,
            quantity: Math.max(1, Math.floor(Number(l.quantity) || 1)),
          })),
        },
      },
      include: { lines: true },
    });

    if (fee > 0) {
      await tx.rentalCharge.create({
        data: {
          tenantId,
          contractId,
          returnId: ret.id,
          chargeType: 'LATE_FEE',
          description: `Late return fee (${daysLate} day(s), ${hours} hours)`,
          amount: fee,
          currency: contract.currency || 'MWK',
          approvalStatus: 'PENDING',
          billingStatus: 'UNBILLED',
          idempotencyKey: `late-${ret.id}`,
        },
      });
    }

    for (const l of returnLines) {
      if (l.rentalUnitId) {
        await tx.rentalUnit.updateMany({
          where: { id: l.rentalUnitId, tenantId },
          data: { availabilityStatus: 'AVAILABLE' },
        });
      }
    }

    await tx.rentalUnitAllocation.updateMany({
      where: { contractId, tenantId, status: { in: ['HELD', 'DISPATCHED', 'CONFIRMED'] } },
      data: { status: 'RELEASED' },
    });

    await tx.rentalContract.update({
      where: { id: contractId },
      data: {
        status: CONTRACT_STATUS.RETURNED,
        returnStatus: 'RETURNED',
        actualReturnAt: returnAt,
        version: { increment: 1 },
      },
    });

    return tx.rentalReturn.findFirst({
      where: { id: ret.id },
      include: { lines: true, charges: true },
    });
  });
}

export async function createInspection({
  tenantId,
  userId,
  returnId,
  rentalUnitId,
  outcome = 'PASSED',
  damageDetected = false,
  maintenanceRequired = false,
  notes,
  damageChargeAmount,
}) {
  const ret = await prisma.rentalReturn.findFirst({
    where: { id: returnId, tenantId },
    include: { contract: true },
  });
  if (!ret) throw new Error('Return not found');

  return prisma.$transaction(async (tx) => {
    const inspection = await tx.rentalInspection.create({
      data: {
        tenantId,
        returnId,
        rentalUnitId: rentalUnitId || null,
        outcome,
        damageDetected: Boolean(damageDetected),
        maintenanceRequired: Boolean(maintenanceRequired),
        notes: notes || null,
        createdById: userId || null,
      },
    });

    let charge = null;
    if (damageDetected && parseMoney(damageChargeAmount) > 0) {
      charge = await tx.rentalCharge.create({
        data: {
          tenantId,
          contractId: ret.contractId,
          returnId,
          inspectionId: inspection.id,
          chargeType: 'DAMAGE',
          description: notes || 'Damage charge',
          amount: parseMoney(damageChargeAmount),
          currency: ret.contract.currency || 'MWK',
          approvalStatus: 'PENDING',
          billingStatus: 'UNBILLED',
          idempotencyKey: `dmg-${inspection.id}`,
        },
      });
    }

    await tx.rentalContract.update({
      where: { id: ret.contractId },
      data: {
        status: CONTRACT_STATUS.FINAL_BILLING_PENDING,
        version: { increment: 1 },
      },
    });

    return { inspection, charge };
  });
}

export async function approveCharge({ tenantId, chargeId, userId }) {
  const charge = await prisma.rentalCharge.findFirst({
    where: { id: chargeId, tenantId },
  });
  if (!charge) throw new Error('Charge not found');
  return prisma.rentalCharge.update({
    where: { id: chargeId },
    data: {
      approvalStatus: 'APPROVED',
      approvedAt: new Date(),
      approvedById: userId || null,
      version: { increment: 1 },
    },
  });
}
