import prisma from '@/lib/prisma';
import { parseMoney, addMoney } from '@/lib/money';
import { allocateNextInvNumberReliable, formatDatedDocumentNumber } from '@/lib/documentSequences';
import { postInvoiceAccounting } from '@/lib/accountingV2/adapters';
import { calculateRentalInvoiceTotals } from '@/lib/rentalInvoiceCalc';
import { getDefaultRentalRevenueAccount } from '@/lib/defaultRentalRevenueAccount';
import {
  requireInvoiceItemAccountIdColumn,
  buildInvoiceItemCreateData,
} from '@/lib/ensureInvoiceItemAccountId';
import { getContract } from './contractService.js';
import { billingIdempotencyKey, computePeriodAmount } from './billing.js';
import { CONTRACT_STATUS } from './contractState.js';

/**
 * Create + post Customer Invoice for a contract billing period (revenue once).
 * Idempotent via RentalBillingPeriod unique key.
 */
export async function invoiceContractPeriod({
  tenantId,
  userId,
  contractId,
  periodStart,
  periodEnd,
  taxRatePercent = 0,
  notes,
  includeApprovedCharges = true,
}) {
  const contract = await getContract({ tenantId, contractId });
  const start = periodStart ? new Date(periodStart) : new Date(contract.startAt);
  const end = periodEnd ? new Date(periodEnd) : new Date(contract.endAt);
  const pricingVersion = contract.pricingVersion || 1;

  const idempotencyKey = billingIdempotencyKey({
    tenantId,
    contractId,
    periodStart: start,
    periodEnd: end,
    pricingVersion,
  });

  const existing = await prisma.rentalBillingPeriod.findUnique({
    where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
  });
  if (existing?.invoiceId) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: existing.invoiceId, tenantId },
      include: { items: true },
    });
    return { period: existing, invoice, duplicate: true };
  }

  const revenue = await getDefaultRentalRevenueAccount(prisma, tenantId);
  const columnCheck = await requireInvoiceItemAccountIdColumn();
  if (!columnCheck.ok) {
    throw new Error('InvoiceItem.accountId column unavailable');
  }
  const invoiceItemHasAccountId = columnCheck.hasColumn;

  const baseAmount = computePeriodAmount(contract, { periodStart: start, periodEnd: end });
  const charges = includeApprovedCharges
    ? (contract.charges || []).filter(
        (c) => c.approvalStatus === 'APPROVED' && c.billingStatus === 'UNBILLED'
      )
    : [];
  const chargeTotal = charges.reduce((s, c) => addMoney(s, c.amount), 0);

  const invoiceLines = [
    {
      description: `Rental ${contract.contractNumber} ${start.toISOString().slice(0, 10)}–${end
        .toISOString()
        .slice(0, 10)}`,
      quantity: 1,
      unitPrice: baseAmount,
      taxRate: Number(taxRatePercent) || 0,
      discountAmount: 0,
      accountId: revenue.id,
      productId: null,
      selectedTaxTypeId: null,
      productTaxes: [],
    },
    ...charges.map((c) => ({
      description: c.description || `${c.chargeType} charge`,
      quantity: 1,
      unitPrice: parseMoney(c.amount),
      taxRate: Number(taxRatePercent) || 0,
      discountAmount: 0,
      accountId: revenue.id,
      productId: null,
      selectedTaxTypeId: null,
      productTaxes: [],
    })),
  ];

  const calculations = calculateRentalInvoiceTotals(invoiceLines, 0);
  const issueDate = new Date();
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + 30);
  const invoicePrefix = 'INV';

  const result = await prisma.$transaction(async (tx) => {
    if (existing && !existing.invoiceId) {
      // period row without invoice — will update below
    } else if (!existing) {
      // create after invoice
    }

    const again = await tx.rentalBillingPeriod.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
    });
    if (again?.invoiceId) {
      const inv = await tx.invoice.findFirst({
        where: { id: again.invoiceId },
        include: { items: true },
      });
      return { period: again, invoice: inv, duplicate: true };
    }

    const seq = await allocateNextInvNumberReliable(tx, tenantId, {
      prefix: invoicePrefix,
      issueDate,
    });
    const invoiceNumber = formatDatedDocumentNumber(invoicePrefix, issueDate, seq);

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        title: `Rental contract ${contract.contractNumber}`,
        orderNumber: null,
        clientId: contract.clientId,
        createdById: userId,
        issueDate,
        dueDate,
        discount: calculations.globalDiscount,
        subtotal: calculations.subtotal,
        taxAmount: calculations.taxAmount,
        totalDiscountAmount: calculations.totalDiscountAmount,
        total: calculations.total,
        status: 'Pending',
        notes: notes || `Billing period for ${contract.contractNumber}`,
        tenantId,
        branchId: contract.branchId || null,
        isRentalInvoice: true,
        remainingBalance: calculations.total,
        originalTotal: calculations.total,
        items: {
          create: calculations.processedItems.map((item) =>
            buildInvoiceItemCreateData(
              {
                ...item,
                description: item.description || 'Rental line',
              },
              invoiceItemHasAccountId
            )
          ),
        },
      },
      include: { items: true },
    });

    await postInvoiceAccounting({
      db: tx,
      tenantId,
      userId,
      invoiceId: invoice.id,
    });

    const periodAmount = addMoney(baseAmount, chargeTotal);
    let period;
    if (again) {
      period = await tx.rentalBillingPeriod.update({
        where: { id: again.id },
        data: {
          invoiceId: invoice.id,
          amount: periodAmount,
          status: 'INVOICED',
        },
      });
    } else {
      period = await tx.rentalBillingPeriod.create({
        data: {
          tenantId,
          contractId,
          periodStart: start,
          periodEnd: end,
          pricingVersion,
          amount: periodAmount,
          invoiceId: invoice.id,
          status: 'INVOICED',
          idempotencyKey,
        },
      });
    }

    if (charges.length) {
      await tx.rentalCharge.updateMany({
        where: { id: { in: charges.map((c) => c.id) } },
        data: { billingStatus: 'INVOICED', invoiceId: invoice.id },
      });
    }

    await tx.rentalContract.update({
      where: { id: contractId },
      data: {
        billingStatus: 'INVOICED',
        status:
          contract.status === CONTRACT_STATUS.FINAL_BILLING_PENDING
            ? CONTRACT_STATUS.COMPLETED
            : contract.status,
        version: { increment: 1 },
      },
    });

    return { period, invoice, duplicate: false };
  });

  return result;
}
