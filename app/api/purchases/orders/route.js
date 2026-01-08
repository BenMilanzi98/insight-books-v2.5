// app/api/purchases/orders/route.js
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

const PO_STATUSES = ['Draft', 'Approved', 'Sent', 'Partially Received', 'Received', 'Cancelled'];

async function generatePurchaseOrderNumber() {
  // Generate a globally unique PO-XXXXX number to avoid collisions across tenants
  let seq = (await prisma.purchaseOrder.count()) + 1;
  let number = `PO-${String(seq).padStart(5, '0')}`;
  while (await prisma.purchaseOrder.findUnique({ where: { poNumber: number } })) {
    seq++;
    number = `PO-${String(seq).padStart(5, '0')}`;
  }
  return number;
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Purchase order items are required');
  }
  items.forEach((item, idx) => {
    if (!item.productId) throw new Error(`Item ${idx + 1}: productId is required`);
    if (item.quantityOrdered === undefined || Number(item.quantityOrdered) <= 0) {
      throw new Error(`Item ${idx + 1}: quantityOrdered must be greater than zero`);
    }
    if (item.unitCost === undefined || Number(item.unitCost) < 0) {
      throw new Error(`Item ${idx + 1}: unitCost cannot be negative`);
    }
  });
}

function parsePagination(searchParams) {
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
  const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
  return { page, limit };
}

function parseSort(searchParams) {
  const sort = searchParams.get('sort') || 'poDate';
  const order = searchParams.get('order') === 'desc' ? 'desc' : 'asc';
  const allowed = ['poDate', 'poNumber', 'status', 'totalAmount', 'supplierName'];
  return { [allowed.includes(sort) ? sort : 'poDate']: order };
}

export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const orderBy = parseSort(searchParams);
    const status = searchParams.get('status');
    const supplierId = searchParams.get('supplierId');
    const search = searchParams.get('search');

    const where = { tenantId: user.tenantId };
    if (status && PO_STATUSES.includes(status)) where.status = status;
    if (supplierId) where.supplierId = supplierId;
    if (search) {
      where.OR = [
        { poNumber: { contains: search, mode: 'insensitive' } },
        { supplier: { supplierName: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const totalCount = await prisma.purchaseOrder.count({ where });
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
      orderBy: [{ poDate: orderBy.poDate || 'desc' }, orderBy],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        supplier: { select: { supplierName: true, supplierCode: true } },
        items: true,
        receipts: { select: { id: true, receiptNumber: true, receiptDate: true } }
      }
    });

    return NextResponse.json({
      purchaseOrders,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return NextResponse.json({ error: 'Failed to fetch purchase orders.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    if (!body.supplierId) {
      return NextResponse.json({ error: 'supplierId is required' }, { status: 400 });
    }
    if (!body.poDate) {
      return NextResponse.json({ error: 'poDate is required' }, { status: 400 });
    }

    validateItems(body.items);

    const supplier = await prisma.supplier.findFirst({
      where: { id: body.supplierId, tenantId: user.tenantId }
    });
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    // Validate product IDs exist and belong to the tenant
    const productIds = [...new Set((body.items || []).map((it) => it.productId).filter(Boolean))];
    if (productIds.length === 0) {
      return NextResponse.json({ error: 'No valid productIds provided in items' }, { status: 400 });
    }
    const products = await prisma.product.findMany({ where: { id: { in: productIds }, tenantId: user.tenantId } });
    if (products.length !== productIds.length) {
      const foundIds = new Set(products.map((p) => p.id));
      const missing = productIds.filter((id) => !foundIds.has(id));
      return NextResponse.json({ error: `Products not found or not accessible: ${missing.join(', ')}` }, { status: 400 });
    }

    const poNumber = body.poNumber?.trim() || await generatePurchaseOrderNumber();
    const subtotal = body.items.reduce(
      (sum, item) => sum + Number(item.quantityOrdered) * Number(item.unitCost),
      0
    );
    const taxAmount = body.taxRate ? subtotal * (Number(body.taxRate) / 100) : 0;
    const totalAmount = subtotal + taxAmount;

    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        tenantId: user.tenantId,
        supplierId: supplier.id,
        poNumber,
        poDate: new Date(body.poDate),
        expectedDeliveryDate: body.expectedDeliveryDate ? new Date(body.expectedDeliveryDate) : null,
        deliveryAddress: body.deliveryAddress || null,
        paymentTerms: body.paymentTerms ?? supplier.paymentTerms ?? 30,
        currency: body.currency || supplier.currency || 'MWK',
        subtotal,
        taxRate: body.taxRate ?? 0,
        taxAmount,
        totalAmount,
        status: 'Approved', // Always save as Approved
        approvedById: user.id,
        approvedDate: new Date(),
        notes: body.notes || null,
        termsAndConditions: body.termsAndConditions || null,
        createdById: user.id,
        items: {
          create: body.items.map((item, index) => ({
            lineNumber: index + 1,
            productId: item.productId,
            description: item.description || null,
            quantityOrdered: new Prisma.Decimal(item.quantityOrdered ?? 0),
            unitCost: new Prisma.Decimal(item.unitCost ?? 0),
            taxRate: item.taxRate ?? 0,
            taxAmount: item.taxAmount ?? 0
          }))
        }
      },
      include: {
        supplier: { select: { supplierName: true } },
        items: true
      }
    });

    return NextResponse.json({ purchaseOrder }, { status: 201 });
  } catch (error) {
    console.error('Error creating purchase order:', error?.message || error);

    // Prisma unique constraint (poNumber) -> 409
    if (error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Purchase order number already exists' }, { status: 409 });
    }

    // Prisma foreign key constraint -> likely a missing/invalid product or supplier ID
    if (error && error.code === 'P2003') {
      return NextResponse.json({ error: 'Invalid reference: missing related record (product/supplier)' }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to create purchase order.' },
      { status: 500 }
    );
  }
}

