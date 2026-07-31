import prisma from '@/lib/prisma';
import { addMoney, parseMoney } from '@/lib/money';
import { makeDocNumber } from './numbering.js';
import { priceRentalLine, pickActiveRatePlan } from './pricing.js';

export async function listQuotations({ tenantId, status, clientId, take = 50 }) {
  return prisma.rentalQuotation.findMany({
    where: {
      tenantId,
      ...(status ? { status } : {}),
      ...(clientId ? { clientId } : {}),
    },
    include: { lines: true },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function getQuotation({ tenantId, quotationId }) {
  const q = await prisma.rentalQuotation.findFirst({
    where: { id: quotationId, tenantId },
    include: { lines: true, reservations: true, contracts: true },
  });
  if (!q) throw new Error('Quotation not found');
  return q;
}

export async function createQuotation({
  tenantId,
  userId,
  clientId,
  startAt,
  endAt,
  notes,
  expiresAt,
  lines = [],
  taxRatePercent = 0,
}) {
  if (!clientId) throw new Error('clientId is required');
  if (!startAt || !endAt) throw new Error('startAt and endAt are required');
  if (!lines.length) throw new Error('At least one line is required');

  const start = new Date(startAt);
  const end = new Date(endAt);
  const client = await prisma.client.findFirst({ where: { id: clientId, tenantId } });
  if (!client) throw new Error('Client not found');

  let subtotal = 0;
  let taxEstimate = 0;
  let depositEstimate = 0;
  const pricedLines = [];

  for (const raw of lines) {
    const asset = await prisma.rentalAsset.findFirst({
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
    const priced = priceRentalLine({
      startAt: start,
      endAt: end,
      rateUnit: billingUnit,
      baseRate: unitRate,
      quantity: qty,
      minimumCharge: raw.minimumCharge ?? plan?.minimumCharge ?? 0,
      depositAmount: raw.depositAmount ?? plan?.depositAmount ?? asset.defaultDeposit ?? 0,
      taxRatePercent: Number(raw.taxRatePercent ?? taxRatePercent) || 0,
    });
    subtotal = addMoney(subtotal, priced.subtotal);
    taxEstimate = addMoney(taxEstimate, priced.tax);
    depositEstimate = addMoney(depositEstimate, priced.deposit);
    pricedLines.push({
      rentalAssetId: asset.id,
      quantity: qty,
      unitRate,
      billableUnits: priced.billableUnits,
      lineTotal: priced.subtotal,
      description: raw.description || asset.name,
      priced,
    });
  }

  return prisma.rentalQuotation.create({
    data: {
      tenantId,
      quotationNumber: makeDocNumber('RQ'),
      clientId,
      status: 'DRAFT',
      startAt: start,
      endAt: end,
      currency: 'MWK',
      subtotal,
      taxEstimate,
      totalEstimate: addMoney(subtotal, taxEstimate),
      depositEstimate,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      pricingSnapshot: { lines: pricedLines.map((l) => l.priced) },
      notes: notes || null,
      createdById: userId || null,
      lines: {
        create: pricedLines.map((l) => ({
          rentalAssetId: l.rentalAssetId,
          quantity: l.quantity,
          unitRate: l.unitRate,
          billableUnits: l.billableUnits,
          lineTotal: l.lineTotal,
          description: l.description,
        })),
      },
    },
    include: { lines: true },
  });
}

export async function transitionQuotation({ tenantId, quotationId, command }) {
  const q = await getQuotation({ tenantId, quotationId });
  const cmd = String(command || '').toLowerCase();
  const map = {
    send: { from: ['DRAFT'], to: 'SENT' },
    accept: { from: ['DRAFT', 'SENT'], to: 'ACCEPTED' },
    reject: { from: ['DRAFT', 'SENT'], to: 'REJECTED' },
    expire: { from: ['DRAFT', 'SENT'], to: 'EXPIRED' },
  };
  const rule = map[cmd];
  if (!rule) throw new Error(`Unknown quotation command "${command}"`);
  if (!rule.from.includes(q.status)) {
    throw new Error(`Command "${command}" not allowed from status "${q.status}"`);
  }
  return prisma.rentalQuotation.update({
    where: { id: quotationId },
    data: { status: rule.to },
    include: { lines: true },
  });
}
