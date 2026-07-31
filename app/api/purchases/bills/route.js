// app/api/purchases/bills/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { finalizeExpenseBill } from '@/lib/supplierBillExpenseFinalize';
import { finalizeInventoryBill } from '@/lib/purchases/finalizeInventoryBill';
import { addMoney, multiplyMoney, roundMoney } from '@/lib/money';
import { resolvePostableExpenseAccount } from '@/lib/accountingMappingRules';
import { isPurchasesGrniEnabled } from '@/lib/purchases/grniPolicy';
import { clearHireAccrualsForSupplierBill } from '@/lib/hiringV2/billAccrualClear';

const BILL_STATUSES = ['Draft', 'Approved', 'Unpaid', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'];
const BILL_TYPES = ['inventory', 'expense', 'stock'];

function parsePagination(searchParams) {
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
  const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
  return { page, limit };
}

export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'purchases.view');
    if (perm) return perm;

    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const status = searchParams.get('status');
    const supplierId = searchParams.get('supplierId');
    const search = searchParams.get('search');

    const where = { tenantId: user.tenantId };
    if (status && BILL_STATUSES.includes(status)) where.status = status;
    if (supplierId) where.supplierId = supplierId;
    if (search) {
      where.OR = [
        { billNumber: { contains: search, mode: 'insensitive' } }
      ];
    }

    const totalCount = await prisma.supplierBill.count({ where });
    const bills = await prisma.supplierBill.findMany({
      where,
      orderBy: { billDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        supplier: { select: { supplierName: true, supplierCode: true } },
        goodsReceipt: { select: { receiptNumber: true } },
        allocations: {
          include: {
            payment: { select: { paymentNumber: true, paymentDate: true } }
          }
        }
      }
    });

    // Fetch items separately for each bill
    const billIds = bills.map(bill => bill.id);
    let allItems = [];
    if (billIds.length > 0) {
      // Check if supplierBillItem model exists, if not try alternative approach
      if (!prisma.supplierBillItem) {
        console.error('Prisma client missing supplierBillItem model. Available models:', Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$')).sort().join(', '));
        // Fallback: return bills without items
        return NextResponse.json({
          bills: bills.map(bill => ({ ...bill, items: [] })),
          pagination: {
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit)
          }
        });
      }
      
      allItems = await prisma.supplierBillItem.findMany({
        where: {
          billId: { in: billIds }
        },
        include: {
          product: { select: { id: true, name: true, sku: true } }
        },
        orderBy: [
          { billId: 'asc' },
          { lineNumber: 'asc' }
        ]
      });
    }

    // Group items by billId
    const itemsByBillId = {};
    allItems.forEach(item => {
      if (!itemsByBillId[item.billId]) {
        itemsByBillId[item.billId] = [];
      }
      itemsByBillId[item.billId].push(item);
    });

    // Attach items to bills
    const billsWithItems = bills.map(bill => ({
      ...bill,
      items: itemsByBillId[bill.id] || []
    }));

    return NextResponse.json({
      bills: billsWithItems,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching supplier bills:', error);
    return NextResponse.json({ error: 'Failed to fetch supplier bills.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'purchases.create');
    if (perm) return perm;

    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.supplierId) {
      return NextResponse.json({ error: 'supplierId is required' }, { status: 400 });
    }
    if (!body.billDate || !body.dueDate) {
      return NextResponse.json({ error: 'billDate and dueDate are required' }, { status: 400 });
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'At least one bill item is required' }, { status: 400 });
    }

    const rawBillType = String(body.billType || 'inventory').toLowerCase();
    if (!BILL_TYPES.includes(rawBillType)) {
      return NextResponse.json(
        { error: 'Invalid bill type. Must be "stock", "inventory", or "expense"' },
        { status: 400 }
      );
    }
    const billType = rawBillType === 'stock' ? 'inventory' : rawBillType;

    const supplier = await prisma.supplier.findFirst({
      where: { id: body.supplierId, tenantId: user.tenantId }
    });
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    // Validate items based on bill type
    if (billType === 'inventory') {
      for (const item of body.items) {
        if (!item.productId) {
          return NextResponse.json({ error: 'Product ID is required for inventory purchase items' }, { status: 400 });
        }
        if (!item.quantity || Number(item.quantity) <= 0) {
          return NextResponse.json({ error: 'Valid quantity is required for inventory items' }, { status: 400 });
        }
        // Verify product exists
        const product = await prisma.product.findFirst({
          where: { id: item.productId, tenantId: user.tenantId }
        });
        if (!product) {
          return NextResponse.json({ error: `Product not found: ${item.productId}` }, { status: 400 });
        }
      }
    } else if (billType === 'expense') {
      for (const item of body.items) {
        if (!item.expenseAccountId) {
          return NextResponse.json({ error: 'Expense account ID is required for expense items' }, { status: 400 });
        }
        if (!item.amount || Number(item.amount) <= 0) {
          return NextResponse.json({ error: 'Valid amount is required for expense items' }, { status: 400 });
        }
        try {
          await resolvePostableExpenseAccount(
            user.tenantId,
            item.expenseAccountId,
            prisma
          );
        } catch (accountError) {
          return NextResponse.json(
            { error: accountError.message || 'Invalid expense account.' },
            { status: 400 }
          );
        }
      }
    }

    const status = body.status && BILL_STATUSES.includes(body.status) ? body.status : 'Draft';
    const isFinalized = status !== 'Draft';

    const grniEnabled = await isPurchasesGrniEnabled(prisma, user.tenantId);
    if (billType === 'inventory' && grniEnabled && isFinalized && !body.goodsReceiptId) {
      return NextResponse.json(
        {
          error:
            'Inventory bills require a Goods Receipt when GRNI is enabled. Receive goods first, then create the bill from the receipt.',
          code: 'RECEIPT_REQUIRED',
        },
        { status: 400 }
      );
    }

    if (body.goodsReceiptId) {
      const gr = await prisma.goodsReceipt.findFirst({
        where: { id: body.goodsReceiptId, tenantId: user.tenantId },
        select: { id: true, supplierId: true, purchaseOrderId: true },
      });
      if (!gr) {
        return NextResponse.json({ error: 'Goods Receipt not found' }, { status: 404 });
      }
      if (gr.supplierId !== supplier.id) {
        return NextResponse.json(
          { error: 'Goods Receipt supplier does not match bill supplier' },
          { status: 400 }
        );
      }
    }

    const invoiceNo = body.supplierInvoiceNumber?.trim() || null;
    if (invoiceNo) {
      const dup = await prisma.supplierBill.findFirst({
        where: {
          tenantId: user.tenantId,
          supplierId: supplier.id,
          supplierInvoiceNumber: invoiceNo,
          status: { not: 'Cancelled' },
        },
        select: { id: true, billNumber: true },
      });
      if (dup) {
        return NextResponse.json(
          {
            error: `Duplicate supplier invoice number. Existing bill ${dup.billNumber}.`,
            code: 'DUPLICATE_SUPPLIER_INVOICE',
            existingBillId: dup.id,
          },
          { status: 409 }
        );
      }
    }

    // Calculate totals
    let subtotal = 0;
    if (billType === 'inventory') {
      subtotal = body.items.reduce(
        (sum, item) => addMoney(sum, multiplyMoney(item.quantity || 0, item.unitCost || 0)),
        0
      );
    } else {
      subtotal = body.items.reduce(
        (sum, item) => addMoney(sum, item.amount || 0),
        0
      );
    }
    const taxAmount = roundMoney(body.taxAmount ?? 0);
    const totalAmount = addMoney(subtotal, taxAmount);

    // Generate bill number
    const billNumber = body.billNumber?.trim() || body.supplierInvoiceNumber?.trim() || `BILL-${Date.now()}`;

    // Create bill with line items in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const bill = await tx.supplierBill.create({
        data: {
          tenantId: user.tenantId,
          supplierId: supplier.id,
          purchaseOrderId: body.purchaseOrderId || null,
          goodsReceiptId: body.goodsReceiptId || null,
          billNumber,
          supplierInvoiceNumber: invoiceNo,
          billDate: new Date(body.billDate),
          dueDate: new Date(body.dueDate),
          billType,
          subtotal,
          taxAmount,
          totalAmount,
          amountPaid: 0,
          status,
          paymentTerms: body.paymentTerms ?? supplier.paymentTerms ?? 30,
          currency: body.currency || supplier.currency || 'MWK',
          notes: body.notes || null,
          idempotencyKey: body.idempotencyKey || null,
          createdById: user.id,
          finalizedAt: isFinalized ? new Date() : null,
          finalizedById: isFinalized ? user.id : null,
          items: {
            create: body.items.map((item, index) => {
              if (billType === 'inventory') {
                return {
                  lineNumber: index + 1,
                  productId: item.productId,
                  purchaseOrderItemId: item.purchaseOrderItemId || null,
                  goodsReceiptItemId: item.goodsReceiptItemId || null,
                  description: item.description || '',
                  quantity: Number(item.quantity),
                  unitCost: Number(item.unitCost),
                  lineTotal: Number(item.quantity) * Number(item.unitCost),
                  taxRate: item.taxRate || 0,
                  taxAmount: item.taxAmount || 0
                };
              }
              return {
                lineNumber: index + 1,
                expenseAccountId: item.expenseAccountId,
                description: item.description || '',
                quantity: null,
                unitCost: Number(item.amount),
                lineTotal: Number(item.amount),
                taxRate: item.taxRate || 0,
                taxAmount: item.taxAmount || 0
              };
            })
          }
        },
        include: {
          supplier: { select: { supplierName: true, supplierCode: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } }
            }
          }
        }
      });

      // Inventory bills never increase stock — only post AP / clear GRNI
      if (isFinalized && billType === 'inventory') {
        await finalizeInventoryBill(tx, bill, user.tenantId, user.id, {
          allowVarianceApproval: Boolean(body.allowVarianceApproval),
        });
      } else if (isFinalized && billType === 'expense') {
        await finalizeExpenseBill(tx, bill, user.tenantId, user.id);
      }

      const billItems = await tx.supplierBillItem.findMany({
        where: { billId: bill.id },
        include: {
          product: { select: { id: true, name: true, sku: true } }
        },
        orderBy: { lineNumber: 'asc' }
      });

      return {
        ...bill,
        items: billItems
      };
    });

    let hireAccrualClear = null;
    if (isFinalized && billType === 'expense') {
      try {
        hireAccrualClear = await clearHireAccrualsForSupplierBill({
          tenantId: user.tenantId,
          userId: user.id,
          billId: result.id,
          hireAccrualIds: body.hireAccrualIds,
        });
      } catch (clearErr) {
        console.warn('hire accrual clear after bill failed', clearErr?.message || clearErr);
        hireAccrualClear = { error: clearErr.message };
      }
    }

    return NextResponse.json({ bill: result, hireAccrualClear }, { status: 201 });
  } catch (error) {
    console.error('Error creating supplier bill:', error);
    const status =
      error.code === 'MATCH_BLOCKED' || error.code === 'RECEIPT_REQUIRED' ? 400 :
      error.code === 'DUPLICATE_SUPPLIER_INVOICE' ? 409 : 500;
    return NextResponse.json(
      { error: error.message || 'Failed to create supplier bill.', code: error.code || undefined },
      { status }
    );
  }
}
