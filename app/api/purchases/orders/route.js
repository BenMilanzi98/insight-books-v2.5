// app/api/purchases/orders/route.js
//
// Inventory policy: creating or updating a purchase order does not change product stock,
// FIFO batches, or inventory transactions. On-hand quantity increases only when a goods
// receipt is posted (see app/api/purchases/receipts/route.js) or when a standalone supplier
// inventory bill is finalized without a linked goods receipt (app/api/purchases/bills/route.js).
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

const PO_STATUSES = ['Draft', 'Approved', 'Sent', 'Partially Received', 'Received', 'Cancelled'];
const ORDER_TYPES = ['goods', 'services', 'mixed', 'assets'];

async function generatePurchaseOrderNumber() {
  const parseSeq = (poNumber) => {
    const m = String(poNumber || '').match(/(\d+)\s*$/);
    return m ? parseInt(m[1], 10) : 0;
  };
  // Use max numeric suffix from recent POs (not count()), so deletes/manual numbers don't skip as badly.
  const recent = await prisma.purchaseOrder.findMany({
    select: { poNumber: true },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });
  let maxSeq = 0;
  for (const r of recent) {
    const n = parseSeq(r.poNumber);
    if (n > maxSeq) maxSeq = n;
  }
  let seq = maxSeq + 1;
  let number = `PO-${String(seq).padStart(5, '0')}`;
  while (await prisma.purchaseOrder.findUnique({ where: { poNumber: number } })) {
    seq += 1;
    number = `PO-${String(seq).padStart(5, '0')}`;
  }
  return number;
}

function getLineType(item) {
  const t = (item.lineType || '').toLowerCase();
  if (t === 'service' || t === 'goods') return t;
  return item.productId ? 'goods' : 'service';
}

function validateItems(items, orderType = 'goods') {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Purchase order items are required');
  }
  items.forEach((item, idx) => {
    const lineType = getLineType(item);
    if (lineType === 'goods') {
      if (!item.productId) throw new Error(`Item ${idx + 1}: productId is required for goods lines`);
    } else {
      if (!item.description?.trim()) throw new Error(`Item ${idx + 1}: description is required for service lines`);
    }
    const qty = Number(item.quantityOrdered ?? 0);
    if (qty <= 0) throw new Error(`Item ${idx + 1}: quantityOrdered must be greater than zero`);
    if (Number(item.unitCost ?? 0) < 0) throw new Error(`Item ${idx + 1}: unitCost cannot be negative`);
  });
}

function parsePagination(searchParams) {
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '25', 10), 1), 500);
  return { page, limit };
}

function buildOrderBy(searchParams) {
  const sort = searchParams.get('sort') || 'poDate';
  const order = searchParams.get('order') === 'desc' ? 'desc' : 'asc';
  // Single-key orderBy to avoid Prisma/DB issues with multi-field sort
  if (sort === 'poNumber') return { poNumber: order };
  if (sort === 'status') return { status: order };
  if (sort === 'totalAmount') return { totalAmount: order };
  return { poDate: order };
}

export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (user.tenantId == null) return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });

    let searchParams;
    try {
      const raw = request.nextUrl ?? request.url;
      if (!raw) throw new Error('Request URL is missing');
      if (typeof raw === 'object' && raw.searchParams) {
        searchParams = raw.searchParams;
      } else {
        const urlStr = String(raw);
        searchParams = urlStr.includes('?') ? new URL(urlStr.startsWith('http') ? urlStr : `http://localhost${urlStr.startsWith('/') ? urlStr : '/' + urlStr}`).searchParams : new URLSearchParams();
      }
    } catch (urlError) {
      console.error('GET /api/purchases/orders URL parse error:', urlError);
      return NextResponse.json(
        { error: process.env.NODE_ENV === 'development' ? (urlError?.message || 'Invalid request URL') : 'Bad request' },
        { status: 400 }
      );
    }
    const { page, limit } = parsePagination(searchParams);
    const orderByClause = buildOrderBy(searchParams);
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
    const includeFull = {
      supplier: { select: { supplierName: true, supplierCode: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true, barcode: true } },
          expenseCategory: {
            select: {
              id: true,
              name: true,
              accountCode: true,
              account: { select: { accountCode: true, accountName: true } }
            }
          }
        }
      },
      receipts: { select: { id: true, receiptNumber: true, receiptDate: true } },
      expenses: { select: { id: true, description: true, amount: true, date: true, status: true } }
    };
    let purchaseOrders;
    try {
      purchaseOrders = await prisma.purchaseOrder.findMany({
        where,
        orderBy: orderByClause,
        skip: (page - 1) * limit,
        take: limit,
        include: includeFull
      });
    } catch (queryError) {
      console.error('Error fetching purchase orders (with expenses):', queryError?.message || queryError);
      // Fallback: retry without expenses include (e.g. if Expense.purchaseOrderId column is missing)
      try {
        const { expenses: _e, ...includeWithoutExpenses } = includeFull;
        purchaseOrders = await prisma.purchaseOrder.findMany({
          where,
          orderBy: orderByClause,
          skip: (page - 1) * limit,
          take: limit,
          include: includeWithoutExpenses
        });
        purchaseOrders = purchaseOrders.map((po) => ({ ...po, expenses: [] }));
      } catch (fallbackError) {
        console.error('Error fetching purchase orders (fallback):', fallbackError?.message || fallbackError);
        const message = process.env.NODE_ENV === 'development'
          ? (fallbackError?.message || String(fallbackError))
          : 'Failed to fetch purchase orders.';
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

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
    const message = process.env.NODE_ENV === 'development' ? (error?.message || String(error)) : 'Failed to fetch purchase orders.';
    return NextResponse.json({ error: message }, { status: 500 });
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

    const orderType = ORDER_TYPES.includes(body.orderType) ? body.orderType : 'goods';
    validateItems(body.items, orderType);

    const supplier = await prisma.supplier.findFirst({
      where: { id: body.supplierId, tenantId: user.tenantId }
    });
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    // Validate product IDs only for items that have productId (goods lines)
    const productIds = [...new Set((body.items || []).map((it) => it.productId).filter(Boolean))];
    if (productIds.length > 0) {
      const products = await prisma.product.findMany({ where: { id: { in: productIds }, tenantId: user.tenantId } });
      if (products.length !== productIds.length) {
        const foundIds = new Set(products.map((p) => p.id));
        const missing = productIds.filter((id) => !foundIds.has(id));
        return NextResponse.json({ error: `Products not found or not accessible: ${missing.join(', ')}` }, { status: 400 });
      }
    }

    // Validate expense category IDs for service lines if provided
    const expenseCategoryIds = [...new Set((body.items || []).map((it) => it.expenseCategoryId).filter(Boolean))];
    if (expenseCategoryIds.length > 0) {
      const categories = await prisma.expenseCategory.findMany({
        where: { id: { in: expenseCategoryIds }, tenantId: user.tenantId }
      });
      if (categories.length !== expenseCategoryIds.length) {
        const found = new Set(categories.map((c) => c.id));
        const missing = expenseCategoryIds.filter((id) => !found.has(id));
        return NextResponse.json({ error: `Expense categories not found: ${missing.join(', ')}` }, { status: 400 });
      }
    }

    // Validate tax type IDs if provided (line-level tax)
    const taxTypeIds = [...new Set((body.items || []).map((it) => it.taxTypeId).filter(Boolean))];
    if (taxTypeIds.length > 0) {
      const taxTypes = await prisma.taxType.findMany({
        where: { id: { in: taxTypeIds }, tenantId: user.tenantId, status: 'Active' }
      });
      if (taxTypes.length !== taxTypeIds.length) {
        const found = new Set(taxTypes.map((t) => t.id));
        const missing = taxTypeIds.filter((id) => !found.has(id));
        return NextResponse.json({ error: `Tax types not found or inactive: ${missing.join(', ')}` }, { status: 400 });
      }
    }

    const poNumber = body.poNumber?.trim() || await generatePurchaseOrderNumber();
    const pricesIncludeTax = Boolean(body.pricesIncludeTax);
    const round2 = (n) => Math.round(Number(n) * 100) / 100;

    // Build items with per-line tax: taxTypeId, taxRate (editable), taxAmount (auto), support pricesIncludeTax
    const itemRows = body.items.map((item, index) => {
      const lineType = getLineType(item);
      const qty = Number(item.quantityOrdered ?? 0);
      const unitCost = Number(item.unitCost ?? 0);
      const taxRatePct = Number(item.taxRate ?? 0);
      let lineSubtotal;
      let lineTaxAmount = Number(item.taxAmount ?? 0);
      if (pricesIncludeTax && taxRatePct > 0) {
        const lineTotalInclusive = qty * unitCost;
        lineSubtotal = lineTotalInclusive / (1 + taxRatePct / 100);
        lineTaxAmount = lineTotalInclusive - lineSubtotal;
      } else {
        lineSubtotal = qty * unitCost;
        if (lineTaxAmount === 0 && taxRatePct > 0) {
          lineTaxAmount = lineSubtotal * (taxRatePct / 100);
        }
      }
      lineSubtotal = round2(lineSubtotal);
      lineTaxAmount = round2(lineTaxAmount);
      return {
        lineNumber: index + 1,
        lineType,
        productId: item.productId || null,
        expenseCategoryId: item.expenseCategoryId || null,
        description: item.description?.trim() || null,
        quantityOrdered: new Prisma.Decimal(qty),
        unitCost: new Prisma.Decimal(unitCost),
        taxTypeId: item.taxTypeId && String(item.taxTypeId).trim() ? item.taxTypeId : null,
        taxRate: taxRatePct,
        taxAmount: lineTaxAmount,
        _lineSubtotal: lineSubtotal
      };
    });

    let subtotal = itemRows.reduce((sum, row) => sum + (row._lineSubtotal ?? Number(row.quantityOrdered) * Number(row.unitCost)), 0);
    let taxAmount = itemRows.reduce((sum, row) => sum + row.taxAmount, 0);
    subtotal = round2(subtotal);
    taxAmount = round2(taxAmount);
    const totalAmount = round2(subtotal + taxAmount);
    const headerTaxRate = subtotal > 0 ? round2((taxAmount / subtotal) * 100) : (body.taxRate ?? 0);

    // PO rows only; no stockLevel / inventoryBatch / inventoryTransaction updates here.
    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        tenantId: user.tenantId,
        supplierId: supplier.id,
        orderType,
        poNumber,
        poDate: new Date(body.poDate),
        expectedDeliveryDate: body.expectedDeliveryDate ? new Date(body.expectedDeliveryDate) : null,
        deliveryAddress: body.deliveryAddress || null,
        paymentTerms: body.paymentTerms ?? supplier.paymentTerms ?? 30,
        currency: body.currency || supplier.currency || 'MWK',
        subtotal,
        taxRate: headerTaxRate,
        taxAmount,
        totalAmount,
        status: 'Approved',
        approvedById: user.id,
        approvedDate: new Date(),
        notes: body.notes || null,
        termsAndConditions: body.termsAndConditions || null,
        pricesIncludeTax,
        supplierInvoiceUrl: body.supplierInvoiceUrl || null,
        createdById: user.id,
        items: {
          create: itemRows.map((row) => ({
            lineNumber: row.lineNumber,
            lineType: row.lineType,
            productId: row.productId,
            expenseCategoryId: row.expenseCategoryId,
            description: row.description,
            quantityOrdered: row.quantityOrdered,
            unitCost: row.unitCost,
            taxTypeId: row.taxTypeId,
            taxRate: row.taxRate,
            taxAmount: row.taxAmount
          }))
        }
      },
      include: {
        supplier: { select: { supplierName: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, barcode: true } },
            expenseCategory: {
              select: {
                id: true,
                name: true,
                accountCode: true,
                account: { select: { accountCode: true, accountName: true } }
              }
            }
          }
        }
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

