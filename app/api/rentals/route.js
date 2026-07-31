import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { resolveBranchId } from '@/lib/branchHelpers';
import { allocateNextInvNumberReliable, formatDatedDocumentNumber } from '@/lib/documentSequences';
import { postInvoiceAccounting } from '@/lib/accountingV2/adapters';
import { calculateRentalInvoiceTotals } from '@/lib/rentalInvoiceCalc';
import { computeBillableUnits } from '@/lib/rentalBilling';
import { assertCanBookLocked } from '@/lib/rentalAvailability';
import { releaseExpiredRentals } from '@/lib/rentalLifecycle';
import { getDefaultRentalRevenueAccount } from '@/lib/defaultRentalRevenueAccount';
import {
  requireInvoiceItemAccountIdColumn,
  buildInvoiceItemCreateData,
} from '@/lib/ensureInvoiceItemAccountId';
import {
  isQuantityPoolKind,
  normalizeOutboundRentalKind,
  outboundKindLabel,
} from '@/lib/rentalKinds';
import { isLegacyRentalBookingEnabled, shouldPostInvoiceOnBook } from '@/lib/rentalBookingPolicy';
import { parseMoney } from '@/lib/money';

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
    const kindRaw = searchParams.get('kind');
    const kind = kindRaw ? normalizeOutboundRentalKind(kindRaw) : null;
    const status = searchParams.get('status');
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)));

    const rows = await prisma.rentalTransaction.findMany({
      where: {
        tenantId: user.tenantId,
        ...(kind ? { kind } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        invoice: {
          select: { id: true, invoiceNumber: true, status: true, total: true, issueDate: true },
        },
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
 * POST — create outbound rental / quantity-pool booking (+ optional invoice)
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

    await releaseExpiredRentals(prisma, user.tenantId);

    const body = await request.json().catch(() => ({}));
    const {
      clientId,
      startAt,
      endAt,
      items = [],
      notes,
      branchId: bodyBranchId,
      discount = 0,
      idempotencyKey: bodyKey,
    } = body;

    const kind = normalizeOutboundRentalKind(body.kind);
    if (!kind) {
      return NextResponse.json(
        {
          error:
            'kind must be rental or quantity pool (hiring / quantity_pool — outbound pool, not supplier hire)',
        },
        { status: 400 }
      );
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

    const idempotencyKey =
      (typeof bodyKey === 'string' && bodyKey.trim()) || `rental-book-${randomUUID()}`;

    const existing = await prisma.rentalTransaction.findFirst({
      where: { tenantId: user.tenantId, idempotencyKey },
      include: {
        invoice: true,
        items: true,
      },
    });
    if (existing) {
      return NextResponse.json(
        { invoice: existing.invoice, rentalTransaction: existing, idempotentReplay: true },
        { status: 200 }
      );
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
    if (!isLegacyRentalBookingEnabled(tenantSettings)) {
      return NextResponse.json(
        {
          error:
            'Legacy rental booking is disabled for this tenant. Use Contracts V2 (/rentals/contracts-v2).',
          code: 'LEGACY_RENTAL_DISABLED',
        },
        { status: 403 }
      );
    }
    const postInvoice = shouldPostInvoiceOnBook(tenantSettings);
    const invoicePrefix = tenantSettings?.invoicePrefix || 'INV';
    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 30);

    let defaultRevenueAccount = null;
    let invoiceItemHasAccountId = false;
    if (postInvoice) {
      const columnCheck = await requireInvoiceItemAccountIdColumn();
      if (!columnCheck.ok) return columnCheck.response;
      invoiceItemHasAccountId = columnCheck.hasColumn;
      try {
        defaultRevenueAccount = await getDefaultRentalRevenueAccount(prisma, user.tenantId);
      } catch (accErr) {
        if (accErr?.code === 'MISSING_4000') {
          return NextResponse.json({ error: accErr.message, code: accErr.code }, { status: 400 });
        }
        throw accErr;
      }
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
      if (normalizeOutboundRentalKind(asset.kind) !== kind) {
        return NextResponse.json(
          { error: `Asset "${asset.name}" is ${asset.kind}, not ${kind}` },
          { status: 400 }
        );
      }

      const rate =
        unitPrice != null ? parseMoney(unitPrice) : parseMoney(asset.defaultRate);
      if (rate < 0) {
        return NextResponse.json({ error: 'unitPrice cannot be negative' }, { status: 400 });
      }

      const billableUnits = computeBillableUnits(start, end, asset.rateUnit || 'day');
      const qty = isQuantityPoolKind(kind)
        ? Math.max(1, Math.floor(Number(quantity) || 1))
        : 1;
      const invoiceQty = billableUnits * (isQuantityPoolKind(kind) ? qty : 1);

      invoiceLines.push({
        description:
          line.description ||
          `${outboundKindLabel(kind)}: ${asset.name} (${(asset.rateUnit || 'day')} billed: ${billableUnits.toFixed(2)})`,
        quantity: invoiceQty,
        unitPrice: rate,
        taxRate: Number(taxRate) || 0,
        discountAmount: 0,
        accountId: defaultRevenueAccount?.id || null,
        productId: null,
        selectedTaxTypeId: line.selectedTaxTypeId || null,
        productTaxes: [],
      });

      metaRows.push({ asset, qty, billableUnits, rate });
    }

    const calculations = calculateRentalInvoiceTotals(invoiceLines, Number(discount) || 0);

    const result = await prisma.$transaction(async (tx) => {
      // Re-check idempotency inside TX
      const again = await tx.rentalTransaction.findFirst({
        where: { tenantId: user.tenantId, idempotencyKey },
        include: { invoice: true, items: true },
      });
      if (again) {
        return { invoice: again.invoice, rentalTransaction: again, idempotentReplay: true };
      }

      for (let i = 0; i < metaRows.length; i++) {
        const { asset, qty } = metaRows[i];
        await assertCanBookLocked(tx, asset, start, end, qty, {});
      }

      let newInvoice = null;
      if (postInvoice) {
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
              : `${outboundKindLabel(kind)} line`,
        }));

        newInvoice = await tx.invoice.create({
          data: {
            invoiceNumber,
            title:
              kind === 'rental' ? 'Room / space rental' : 'Quantity rental (equipment pool)',
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
                buildInvoiceItemCreateData(item, invoiceItemHasAccountId)
              ),
            },
          },
          include: { items: true },
        });
      }

      const rt = await tx.rentalTransaction.create({
        data: {
          tenantId: user.tenantId,
          invoiceId: newInvoice?.id || null,
          clientId,
          kind,
          startAt: start,
          endAt: end,
          status: 'booked',
          totalAmount: calculations.total,
          notes: notes || null,
          idempotencyKey,
          createdById: user.id,
        },
      });

      for (let i = 0; i < metaRows.length; i++) {
        const { asset, qty, billableUnits, rate } = metaRows[i];
        const lineCalc = calculations.processedItems[i];
        const total = parseMoney(lineCalc.amount);

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
            tenantId: user.tenantId,
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

      if (postInvoice && newInvoice?.id) {
        await postInvoiceAccounting({
          db: tx,
          tenantId: user.tenantId,
          userId: user.id,
          invoiceId: newInvoice.id,
        });
      }

      await tx.auditLog.create({
        data: {
          action: 'RENTAL_BOOKING_CREATED',
          entityType: 'RENTAL_TRANSACTION',
          entityId: rt.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            kind,
            total: calculations.total,
            postInvoice,
            invoiceId: newInvoice?.id || null,
            idempotencyKey,
          }),
        },
      });

      return {
        invoice: newInvoice,
        rentalTransaction: rt,
        postInvoice,
        accountingPosted: !!postInvoice,
      };
    });

    return NextResponse.json(result, { status: result.idempotentReplay ? 200 : 201 });
  } catch (e) {
    const msg = e?.message || 'Failed to create rental';
    const code = e?.code;
    if (code === 'MISSING_4000') {
      return NextResponse.json({ error: msg, code }, { status: 400 });
    }
    if (code === 'DOUBLE_BOOK' || code === 'OVERBOOK_QTY') {
      return NextResponse.json({ error: msg, code }, { status: 409 });
    }
    if (code === 'P2002') {
      return NextResponse.json(
        {
          error:
            'A booking with this idempotency key already exists (or unique constraint conflict). Retry GET list or reuse the same key.',
          code: 'IDEMPOTENCY_CONFLICT',
        },
        { status: 409 }
      );
    }
    console.error('[rentals POST]', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
