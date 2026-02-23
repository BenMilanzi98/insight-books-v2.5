// app/api/purchases/bills/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { generateReferenceNumber } from '@/lib/journalService';
import { createFifoBatch } from '@/lib/fifoCosting';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';
import { getTaxOutflowAccount } from '@/lib/transactionJournalHelpers';
import { updateAccountBalanceOnTransaction } from '@/lib/accountBalanceService';

const BILL_STATUSES = ['Draft', 'Approved', 'Unpaid', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'];
const BILL_TYPES = ['inventory', 'expense'];

function parsePagination(searchParams) {
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
  const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
  return { page, limit };
}

export async function GET(request) {
  try {
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

    const billType = body.billType || 'inventory';
    if (!BILL_TYPES.includes(billType)) {
      return NextResponse.json({ error: 'Invalid bill type. Must be "inventory" or "expense"' }, { status: 400 });
    }

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
      }
    }

    const status = body.status && BILL_STATUSES.includes(body.status) ? body.status : 'Draft';
    const isFinalized = status !== 'Draft';

    // Calculate totals
    let subtotal = 0;
    if (billType === 'inventory') {
      subtotal = body.items.reduce(
        (sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitCost || 0)),
        0
      );
    } else {
      subtotal = body.items.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      );
    }
    const taxAmount = body.taxAmount ?? 0;
    const totalAmount = subtotal + taxAmount;

    // Generate bill number
    const billNumber = body.billNumber?.trim() || body.supplierInvoiceNumber?.trim() || `BILL-${Date.now()}`;

    // Create bill with line items in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create bill
      const bill = await tx.supplierBill.create({
        data: {
          tenantId: user.tenantId,
          supplierId: supplier.id,
          billNumber,
          supplierInvoiceNumber: body.supplierInvoiceNumber || null,
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
          createdById: user.id,
          finalizedAt: isFinalized ? new Date() : null,
          finalizedById: isFinalized ? user.id : null,
          items: {
            create: body.items.map((item, index) => {
              if (billType === 'inventory') {
                return {
                  lineNumber: index + 1,
                  productId: item.productId,
                  description: item.description || '',
                  quantity: Number(item.quantity),
                  unitCost: Number(item.unitCost),
                  lineTotal: Number(item.quantity) * Number(item.unitCost),
                  taxRate: item.taxRate || 0,
                  taxAmount: item.taxAmount || 0
                };
              } else {
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
              }
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

      // If finalized, update inventory and create journal entries
      if (isFinalized && billType === 'inventory') {
        await finalizeInventoryPurchaseBill(tx, bill, user.tenantId, user.id);
      } else if (isFinalized && billType === 'expense') {
        await finalizeExpenseBill(tx, bill, user.tenantId, user.id);
      }

      // Fetch items separately since include might not work
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

    return NextResponse.json({ bill: result }, { status: 201 });
  } catch (error) {
    console.error('Error creating supplier bill:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create supplier bill.' },
      { status: 500 }
    );
  }
}

/**
 * Finalize inventory purchase bill - update inventory and create journal entries
 */
async function finalizeInventoryPurchaseBill(tx, bill, tenantId, userId) {
  // Fetch bill with goodsReceiptId to check if it's from a goods receipt
  const billWithReceipt = await tx.supplierBill.findUnique({
    where: { id: bill.id },
    select: { id: true, goodsReceiptId: true, billNumber: true }
  });
  
  // Get or create inventory account
  let inventoryAccount = await tx.account.findFirst({
    where: {
      tenantId,
      accountCode: '1300',
      accountType: 'Asset',
      isActive: true
    }
  });

  if (!inventoryAccount) {
    inventoryAccount = await tx.account.findFirst({
      where: {
        tenantId,
        accountName: { contains: 'Inventory', mode: 'insensitive' },
        accountType: 'Asset',
        isActive: true
      }
    });
  }

  if (!inventoryAccount) {
    throw new Error('Inventory account not found. Please set up your chart of accounts.');
  }

  // Get or create accounts payable account
  let apAccount = await tx.account.findFirst({
    where: {
      tenantId,
      accountCode: '2100',
      accountType: 'Liability',
      isActive: true
    }
  });

  if (!apAccount) {
    apAccount = await tx.account.findFirst({
      where: {
        tenantId,
        accountName: { contains: 'Accounts Payable', mode: 'insensitive' },
        accountType: 'Liability',
        isActive: true
      }
    });
  }

  if (!apAccount) {
    throw new Error('Accounts Payable account not found. Please set up your chart of accounts.');
  }

  // Update inventory for each line item
  // IMPORTANT: If this bill was created from a goods receipt, FIFO batches were already created
  // when the goods receipt was created, so we skip FIFO batch creation here to avoid double counting
  const isFromGoodsReceipt = !!billWithReceipt?.goodsReceiptId;
  
  for (const item of bill.items) {
    if (!item.productId) continue;

    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { id: true, tenantId: true, branchId: true }
    });

    if (!product) continue;

    const quantity = Number(item.quantity || 0);
    const unitCost = Number(item.unitCost || 0);

    // Only create FIFO batch if this bill is NOT from a goods receipt
    // (goods receipts already created the FIFO batches)
    if (!isFromGoodsReceipt) {
      // FIFO batch creation is the source of truth for cost (system-generated)
      await createFifoBatch({
        tenantId,
        branchId: product.branchId || null,
        productId: product.id,
        quantityPurchased: quantity,
        unitCost,
        purchaseDate: bill.billDate,
        sourceType: 'SupplierBill',
        sourceId: bill.id,
        tx,
      });
    } else {
      console.log(`Skipping FIFO batch creation for bill ${bill.billNumber} - already created from goods receipt ${bill.goodsReceiptId}`);
    }

    // Create inventory transaction record
    await tx.inventoryTransaction.create({
      data: {
        productId: product.id,
        type: 'purchase',
        quantity: quantity,
        notes: `Purchase Bill ${bill.billNumber}`,
        userId: userId,
        tenantId: tenantId,
        branchId: product.branchId || null
      }
    });
  }

  // Create journal entry
  const entryDate = bill.billDate instanceof Date ? bill.billDate : new Date(bill.billDate);
  await assertPeriodOpen(tenantId, entryDate, tx);
  const referenceNumber = await generateReferenceNumber(tx, tenantId, entryDate);

  const transaction = await tx.transaction.create({
    data: {
      tenantId,
      date: entryDate,
      reference: referenceNumber,
      description: `Purchase Bill ${bill.billNumber} - ${bill.supplier.supplierName}`,
      entryType: 'Regular',
      status: 'posted',
      sourceType: 'SupplierBill',
      sourceId: bill.id,
      createdById: userId,
      postedById: userId,
      postedDate: new Date(),
      lines: {
        create: [
          {
            lineNumber: 1,
            accountId: inventoryAccount.id,
            debitAmount: bill.totalAmount,
            creditAmount: 0,
            description: `Inventory purchase - ${bill.billNumber}`
          },
          {
            lineNumber: 2,
            accountId: apAccount.id,
            debitAmount: 0,
            creditAmount: bill.totalAmount,
            description: `Accounts Payable - ${bill.supplier.supplierName}`
          }
        ]
      }
    }
  });

  // Link journal entry to bill
  await tx.supplierBill.update({
    where: { id: bill.id },
    data: { journalEntryId: transaction.id }
  });

  // Update supplier current balance
  await tx.supplier.update({
    where: { id: bill.supplierId },
    data: {
      currentBalance: {
        increment: bill.totalAmount
      }
    }
  });
}

/**
 * Finalize expense bill - create journal entries (no inventory update)
 */
async function finalizeExpenseBill(tx, bill, tenantId, userId) {
  // Get or create accounts payable account
  let apAccount = await tx.account.findFirst({
    where: {
      tenantId,
      accountCode: '2100',
      accountType: 'Liability',
      isActive: true
    }
  });

  if (!apAccount) {
    apAccount = await tx.account.findFirst({
      where: {
        tenantId,
        accountName: { contains: 'Accounts Payable', mode: 'insensitive' },
        accountType: 'Liability',
        isActive: true
      }
    });
  }

  if (!apAccount) {
    throw new Error('Accounts Payable account not found. Please set up your chart of accounts.');
  }

  // Create journal entry lines for each expense item
  const entryDate = bill.billDate instanceof Date ? bill.billDate : new Date(bill.billDate);
  const referenceNumber = await generateReferenceNumber(tx, tenantId, entryDate);

  const billTotal = Number(bill.totalAmount || 0);
  const billTax = Number(bill.taxAmount || 0);
  const expenseTotal = billTotal - billTax;
  const taxAccount = billTax > 0 ? await getTaxOutflowAccount(tenantId, tx) : null;
  const scale = billTotal > 0 && billTax > 0 && taxAccount ? expenseTotal / billTotal : 1;

  const lines = [];
  let lineNum = 1;

  for (const item of bill.items) {
    if (!item.expenseAccountId) continue;

    const expenseAccount = await tx.account.findFirst({
      where: {
        id: item.expenseAccountId,
        tenantId,
        isActive: true
      }
    });

    if (!expenseAccount) {
      throw new Error(`Expense account not found: ${item.expenseAccountId}`);
    }

    const itemDebit = Number(item.lineTotal || 0) * scale;
    lines.push({
      lineNumber: lineNum++,
      accountId: expenseAccount.id,
      debitAmount: itemDebit,
      creditAmount: 0,
      description: item.description || `Expense - ${bill.billNumber}`
    });
  }

  if (billTax > 0 && taxAccount) {
    lines.push({
      lineNumber: lineNum++,
      accountId: taxAccount.id,
      debitAmount: billTax,
      creditAmount: 0,
      description: `Tax on bill - ${bill.billNumber}`
    });
  }

  lines.push({
    lineNumber: lineNum,
    accountId: apAccount.id,
    debitAmount: 0,
    creditAmount: billTotal,
    description: `Accounts Payable - ${bill.supplier.supplierName}`
  });

  // Create transaction
  const transaction = await tx.transaction.create({
    data: {
      tenantId,
      date: entryDate,
      reference: referenceNumber,
      description: `Expense Bill ${bill.billNumber} - ${bill.supplier.supplierName}`,
      entryType: 'Regular',
      status: 'posted',
      sourceType: 'SupplierBill',
      sourceId: bill.id,
      createdById: userId,
      postedById: userId,
      postedDate: new Date(),
      lines: {
        create: lines
      }
    },
    include: { lines: true }
  });

  // Update account balances for all lines (expense debits, tax debit, AP credit)
  for (const line of transaction.lines) {
    await updateAccountBalanceOnTransaction(
      line.accountId,
      line.debitAmount,
      line.creditAmount,
      tx
    );
  }

  // Link journal entry to bill
  await tx.supplierBill.update({
    where: { id: bill.id },
    data: { journalEntryId: transaction.id }
  });

  // Update supplier current balance
  await tx.supplier.update({
    where: { id: bill.supplierId },
    data: {
      currentBalance: {
        increment: bill.totalAmount
      }
    }
  });
}

