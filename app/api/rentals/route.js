import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { resolveBranchId } from '@/lib/branchHelpers';
import { allocateNextInvNumberReliable, formatDatedDocumentNumber } from '@/lib/documentSequences';
import { createInvoiceJournalEntry } from '@/lib/transactionJournalHelpers';
import { calculateRentalInvoiceTotals } from '@/lib/rentalInvoiceCalc';
import { computeBillableUnits } from '@/lib/rentalBilling';
import { assertCanBook } from '@/lib/rentalAvailability';
import { releaseExpiredRentals } from '@/lib/rentalLifecycle';
import { getDefaultRentalRevenueAccount } from '@/lib/defaultRentalRevenueAccount';
import {
  requireInvoiceItemAccountIdColumn,
  buildInvoiceItemCreateData,
} from '@/lib/ensureInvoiceItemAccountId';

function canCreateRental(user) {
  return (
    hasPermission(user, 'rentals.create') ||
    hasPermission(user, 'invoices.create')
  );
}

function canViewRentals(user) {
  return (
    hasPermission(user, 'rentals.view') ||
    hasPermission(user, 'rentals.export') ||
    canCreateRental(user) ||
    hasPermission(user, 'invoices.view')
  );
}

/**
 * GET — list rental transactions (with invoice + client summary)
 */
export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!canViewRentals(user)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    await releaseExpiredRentals(prisma, user.tenantId);

    const { searchParams } = new URL(request.url);
    const kind = searchParams.get('kind');
    const status = searchParams.get('status');
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)));

    const rows = await prisma.rentalTransaction.findMany({
      where: {
        tenantId: user.tenantId,
        ...(kind && ['rental', 'hiring'].includes(kind) ? { kind } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        invoice: { select: { id: true, invoiceNumber: true, status: true, total: true, issueDate: true } },
        client: { select: { id: true, name: true, email: true } },
        items: { include: { rentalAsset: { select: { id: true, name: true, kind: true } } } },
      },
    });

    return NextResponse.json({ transactions: rows });
  } catch (e) {
    console.error('[rentals GET]', e);
    return NextResponse.json({ error: 'Failed to list rentals' }, { status: 500 });
  }
}

/**
 * POST — create rental/hiring booking + invoice + availability blocks
 */
export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!canCreateRental(user)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const columnCheck = await requireInvoiceItemAccountIdColumn();
    if (!columnCheck.ok) return columnCheck.response;
    const invoiceItemHasAccountId = columnCheck.hasColumn;

    await releaseExpiredRentals(prisma, user.tenantId);

    const body = await request.json().catch(() => ({}));
    const {
      kind,
      clientId,
      startAt,
      endAt,
      items = [],
      notes,
      branchId: bodyBranchId,
      discount = 0,
    } = body;

    if (!kind || !['rental', 'hiring'].includes(kind)) {
      return NextResponse.json({ error: 'kind must be rental or hiring' }, { status: 400 });
    }
    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }
    if (!startAt || !endAt) {
      return NextResponse.json({ error: 'startAt and endAt are required' }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 });
    }

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (!(end > start)) {
      return NextResponse.json({ error: 'endAt must be after startAt' }, { status: 400 });
    }

    const client = await prisma.client.findFirst({
      where: { id: clientId, tenantId: user.tenantId },
    });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    let branchId;
    try {
      branchId = await resolveBranchId(user, bodyBranchId, user.tenantId);
    } catch (branchErr) {
      return NextResponse.json({ error: branchErr.message || 'Invalid branch' }, { status: 403 });
    }

    const tenantSettings = await prisma.tenantSettings.findFirst({
      where: { tenantId: user.tenantId },
    });
    const invoicePrefix = tenantSettings?.invoicePrefix || 'INV';
    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 30);

    let defaultRevenueAccount;
    try {
      defaultRevenueAccount = await getDefaultRentalRevenueAccount(prisma, user.tenantId);
    } catch (accErr) {
      if (accErr?.code === 'MISSING_4000') {
        return NextResponse.json({ error: accErr.message, code: accErr.code }, { status: 400 });
      }
      throw accErr;
    }

    const invoiceLines = [];
    const metaRows = [];

    for (const line of items) {
      const { rentalAssetId, quantity = 1, unitPrice, taxRate = 0 } = line;
      if (!rentalAssetId) {
        return NextResponse.json({ error: 'Each item needs rentalAssetId' }, { status: 400 });
      }

      const asset = await prisma.rentalAsset.findFirst({
        where: { id: rentalAssetId, tenantId: user.tenantId, isActive: true },
      });
      if (!asset) {
        return NextResponse.json({ error: `Rental asset not found: ${rentalAssetId}` }, { status: 404 });
      }
      if (asset.kind !== kind) {
        return NextResponse.json(
          { error: `Asset "${asset.name}" is ${asset.kind}, not ${kind}` },
          { status: 400 }
        );
      }

      const rate = unitPrice != null ? Number(unitPrice) : Number(asset.defaultRate) || 0;
      if (rate < 0) {
        return NextResponse.json({ error: 'unitPrice cannot be negative' }, { status: 400 });
      }

      const billableUnits = computeBillableUnits(start, end, asset.rateUnit || 'day');
      const qty = kind === 'hiring' ? Math.max(1, Math.floor(Number(quantity) || 1)) : 1;
      // Invoice math: quantity × unitPrice = rate × billableUnits × qty
      const invoiceQty = billableUnits * (kind === 'hiring' ? qty : 1);

      invoiceLines.push({
        description:
          line.description ||
          `${kind === 'rental' ? 'Rental' : 'Hiring'}: ${asset.name} (${(asset.rateUnit || 'day')} billed: ${billableUnits.toFixed(2)})`,
        quantity: invoiceQty,
        unitPrice: rate,
        taxRate: Number(taxRate) || 0,
        discountAmount: 0,
        accountId: defaultRevenueAccount.id,
        productId: null,
        selectedTaxTypeId: line.selectedTaxTypeId || null,
        productTaxes: [],
      });

      metaRows.push({ asset, qty, billableUnits, rate });
    }

    const calculations = calculateRentalInvoiceTotals(invoiceLines, Number(discount) || 0);

    const result = await prisma.$transaction(async (tx) => {
      for (let i = 0; i < metaRows.length; i++) {
        const { asset, qty } = metaRows[i];
        await assertCanBook(tx, asset, start, end, qty, {});
      }

      const seq = await allocateNextInvNumberReliable(tx, user.tenantId, {
        prefix: invoicePrefix,
        issueDate,
      });
      const invoiceNumber = formatDatedDocumentNumber(invoicePrefix, issueDate, seq);

      const itemsWithTitles = calculations.processedItems.map((item) => ({
        ...item,
        description:
          item.description && String(item.description).trim()
            ? item.description
            : `Rental / hiring line`,
      }));

      const newInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          title: kind === 'rental' ? 'Room / space rental' : 'Equipment hiring',
          orderNumber: null,
          clientId,
          createdById: user.id,
          issueDate,
          dueDate,
          discount: calculations.globalDiscount,
          subtotal: calculations.subtotal,
          taxAmount: calculations.taxAmount,
          totalDiscountAmount: calculations.totalDiscountAmount,
          total: calculations.total,
          status: 'Pending',
          notes: notes || null,
          tenantId: user.tenantId,
          branchId,
          isRentalInvoice: true,
          remainingBalance: calculations.total,
          originalTotal: calculations.total,
          items: {
            create: itemsWithTitles.map((item) =>
              buildInvoiceItemCreateData(item, invoiceItemHasAccountId),
            ),
          },
        },
        include: { items: true },
      });

      const rt = await tx.rentalTransaction.create({
        data: {
          tenantId: user.tenantId,
          invoiceId: newInvoice.id,
          clientId,
          kind,
          startAt: start,
          endAt: end,
          status: 'booked',
          totalAmount: calculations.total,
          notes: notes || null,
          createdById: user.id,
        },
      });

      for (let i = 0; i < metaRows.length; i++) {
        const { asset, qty, billableUnits, rate } = metaRows[i];
        const lineCalc = calculations.processedItems[i];
        const total = Number(lineCalc.amount);

        await tx.rentalItem.create({
          data: {
            rentalTransactionId: rt.id,
            rentalAssetId: asset.id,
            quantity: qty,
            unitRate: rate,
            billableUnits,
            total,
            returnedQuantity: 0,
          },
        });

        await tx.rentalAssetAvailability.create({
          data: {
            rentalAssetId: asset.id,
            rentalTransactionId: rt.id,
            startAt: start,
            endAt: end,
            status: 'booked',
            quantity: qty,
          },
        });

        if (kind === 'rental') {
          await tx.rentalAsset.update({
            where: { id: asset.id },
            data: { status: 'booked' },
          });
        }
      }

      await createInvoiceJournalEntry({
        tenantId: user.tenantId,
        userId: user.id,
        invoiceId: newInvoice.id,
        invoiceNumber,
        issueDate,
        totalAmount: calculations.total,
        items: calculations.processedItems.map((it) => ({
          ...it,
          amount: it.amount,
        })),
        hasServices: true,
        cogsAmount: 0,
        taxAmount: 0,
        taxTypeId: null,
        tx,
      });

      if (calculations.taxAmount > 0) {
        const { autoPostTaxEntry } = await import('@/lib/taxCalculationService');
        const taxByType = {};
        for (const item of calculations.processedItems) {
          const taxTypeId = item.selectedTaxTypeId;
          if (taxTypeId && Number(item.taxAmount) > 0) {
            if (!taxByType[taxTypeId]) taxByType[taxTypeId] = { taxTypeId, totalTax: 0 };
            taxByType[taxTypeId].totalTax += Number(item.taxAmount);
          }
        }
        for (const { taxTypeId, totalTax } of Object.values(taxByType)) {
          try {
            await autoPostTaxEntry({
              tenantId: user.tenantId,
              userId: user.id,
              taxTypeId,
              taxAmount: totalTax,
              transactionDate: issueDate,
              sourceType: 'Invoice',
              sourceId: newInvoice.id,
              description: `Tax for invoice ${invoiceNumber}`,
              tx,
            });
          } catch (taxPostErr) {
            console.warn('Rental invoice tax post:', taxPostErr?.message);
          }
        }
      }

      await tx.auditLog.create({
        data: {
          action: 'RENTAL_BOOKING_CREATED',
          entityType: 'RENTAL_TRANSACTION',
          entityId: rt.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({ invoiceNumber, kind, total: calculations.total }),
        },
      });

      return { invoice: newInvoice, rentalTransaction: rt };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const msg = e?.message || 'Failed to create rental';
    const code = e?.code;
    if (code === 'MISSING_4000') {
      return NextResponse.json({ error: msg, code }, { status: 400 });
    }
    if (code === 'DOUBLE_BOOK' || code === 'OVERBOOK_QTY') {
      return NextResponse.json({ error: msg, code }, { status: 409 });
    }
    console.error('[rentals POST]', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
