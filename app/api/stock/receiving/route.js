import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

function num(d) {
  if (d == null) return 0;
  return Number(d);
}

/**
 * Dashboard data for /stock receiving: open PO lines (goods) and receipts not yet fully in stock.
 */
export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (user.tenantId == null || user.tenantId === '') {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }
    const tenantId = user.tenantId;

    const openPoStatuses = ['Approved', 'Sent', 'Partially Received'];
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        status: { in: openPoStatuses },
        orderType: { in: ['goods', 'mixed'] },
      },
      orderBy: { poDate: 'desc' },
      take: 100,
      include: {
        supplier: { select: { id: true, supplierName: true, supplierCode: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, barcode: true } },
          },
        },
      },
    });

    const orderedGoodsOutstanding = [];
    for (const po of purchaseOrders) {
      const lines = [];
      for (const item of po.items || []) {
        const lineType = (item.lineType || 'goods').toLowerCase();
        if (lineType !== 'goods' || !item.productId) continue;
        const ordered = num(item.quantityOrdered);
        const received = num(item.quantityReceived);
        const remaining = Math.max(0, ordered - received);
        if (remaining <= 0) continue;
        lines.push({
          lineId: item.id,
          productId: item.productId,
          productName: item.product?.name || 'Product',
          sku: item.product?.sku || '',
          quantityOrdered: ordered,
          quantityReceived: received,
          quantityRemaining: remaining,
          unitCost: num(item.unitCost),
        });
      }
      if (lines.length === 0) continue;
      orderedGoodsOutstanding.push({
        id: po.id,
        poNumber: po.poNumber,
        poDate: po.poDate,
        status: po.status,
        supplierId: po.supplierId,
        supplierName: po.supplier?.supplierName || '',
        orderType: po.orderType,
        lines,
      });
    }

    const postedInventoryPending = await prisma.goodsReceipt.findMany({
      where: {
        tenantId,
        status: 'Posted',
        inventoryAppliedAt: null,
        items: { some: {} },
      },
      orderBy: { receiptDate: 'desc' },
      take: 40,
      include: {
        supplier: { select: { supplierName: true, supplierCode: true } },
        purchaseOrder: { select: { id: true, poNumber: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });

    const goodsReceivedPosted = await prisma.goodsReceipt.findMany({
      where: {
        tenantId,
        status: 'Posted',
        inventoryAppliedAt: { not: null },
        items: { some: {} },
      },
      orderBy: { receiptDate: 'desc' },
      take: 30,
      include: {
        supplier: { select: { supplierName: true, supplierCode: true } },
        purchaseOrder: { select: { id: true, poNumber: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });

    const mapReceipt = (r) => ({
      id: r.id,
      receiptNumber: r.receiptNumber,
      receiptDate: r.receiptDate,
      status: r.status,
      supplierName: r.supplier?.supplierName || '',
      poNumber: r.purchaseOrder?.poNumber || null,
      purchaseOrderId: r.purchaseOrderId,
      totalAmount: r.totalAmount,
      itemCount: Array.isArray(r.items) ? r.items.length : 0,
      inventoryAppliedAt: r.inventoryAppliedAt,
      items: (r.items || []).map((it) => ({
        id: it.id,
        productName: it.product?.name || '—',
        sku: it.product?.sku || '',
        quantityReceived: num(it.quantityReceived),
        unitCost: num(it.unitCost),
      })),
    });

    return NextResponse.json({
      orderedGoodsOutstanding,
      postedInventoryPending: postedInventoryPending.map(mapReceipt),
      goodsReceivedPosted: goodsReceivedPosted.map(mapReceipt),
    });
  } catch (error) {
    console.error('GET /api/stock/receiving:', error);
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === 'development'
            ? error?.message || String(error)
            : 'Failed to load receiving data.',
      },
      { status: 500 }
    );
  }
}
