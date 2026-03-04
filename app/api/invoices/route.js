// app/api/invoices/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { createInvoiceJournalEntry, createInvoicePaymentJournalEntry } from '@/lib/transactionJournalHelpers';
import { requireStandardAccess } from '@/lib/accessControl';
import { calculateCOGS } from '@/lib/inventoryCosting';
import { resolveBranchId } from '@/lib/branchHelpers';

// Enhanced helper function to calculate invoice totals with discounts
function calculateInvoiceTotals(items, globalDiscount = 0) {
  let subtotal = 0;
  let totalDiscountAmount = 0;
  
  const processedItems = items.map(item => {
    // Calculate line total before discount
    const lineTotal = item.quantity * item.unitPrice;
    
    // Interpret discountAmount as per-item discount; convert to line discount
    const perItemDiscount = item.discountAmount || 0;
    const lineDiscountAmount = perItemDiscount * item.quantity;
    
    // Calculate net amount after discount
    const netLineAmount = lineTotal - lineDiscountAmount;
    
    // Calculate tax on net amount
    const lineTaxAmount = netLineAmount * ((item.taxRate || 0) / 100);
    
    // Calculate final amount including tax
    const finalAmount = netLineAmount + lineTaxAmount;
    
    // Add to totals
    subtotal += lineTotal;
    totalDiscountAmount += lineDiscountAmount;
    
    return {
      // Only include fields needed for database
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate || 0,
      discountAmount: Number(perItemDiscount.toFixed(2)),
      netAmount: Number(netLineAmount.toFixed(2)),
      amount: Number(finalAmount.toFixed(2)),
      taxAmount: Number(lineTaxAmount.toFixed(2)),
      productId: item.productId || null,
      accountId: item.accountId,
      selectedTaxTypeId: item.selectedTaxTypeId || null,
      productTaxes: item.productTaxes || [],
    };
  });
  
  // Apply global discount to the net subtotal (after line item discounts)
  const netSubtotalBeforeGlobal = subtotal - totalDiscountAmount;
  const validGlobalDiscount = Math.max(0, Math.min(globalDiscount || 0, netSubtotalBeforeGlobal));
  
  // Calculate tax on the net amount after global discount
  const finalNetSubtotal = netSubtotalBeforeGlobal - validGlobalDiscount;
  
  // Calculate total tax from processed items (this should already include line item taxes)
  let totalTaxAmount = 0;
  processedItems.forEach(item => {
    const lineTotal = item.quantity * item.unitPrice;
    const perItemDiscount = item.discountAmount || 0;
    const lineDiscountAmount = perItemDiscount * item.quantity;
    const netLineAmount = lineTotal - lineDiscountAmount;
    totalTaxAmount += netLineAmount * ((item.taxRate || 0) / 100);
  });
  
  const total = finalNetSubtotal + totalTaxAmount;
  
  return {
    processedItems,
    subtotal: Number(subtotal.toFixed(2)),
    totalDiscountAmount: Number(totalDiscountAmount.toFixed(2)),
    globalDiscount: Number(validGlobalDiscount.toFixed(2)),
    taxAmount: Number(totalTaxAmount.toFixed(2)),
    total: Number(total.toFixed(2))
  };
}

// GET - Fetch invoices with filtering, sorting, and pagination
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const status = searchParams.get('status');
    const client = searchParams.get('client');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Build filter object for Prisma
    const where = {
      tenantId: user.tenantId
    };
    
    // Add branch filter if provided
    const branchId = searchParams.get('branchId');
    if (branchId) {
      where.branchId = branchId;
    }
    
    // Add status filter if provided (align with statistics: Pending = not yet due, Overdue = past due or status Overdue)
    if (status) {
      if (status.includes(',')) {
        where.status = {
          in: status.split(',').map(s => s.trim())
        };
      } else if (status === 'Overdue') {
        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);
        where.OR = [
          { status: 'Overdue' },
          { status: 'Pending', dueDate: { lt: startOfToday } }
        ];
      } else if (status === 'Pending') {
        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);
        where.status = 'Pending';
        where.dueDate = { gte: startOfToday };
      } else {
        where.status = status;
      }
    }
    
    // Add client filter if provided
    if (client) {
      where.clientId = client;
    }
    
    // Add date range filters
    if (dateFrom) {
      where.issueDate = {
        ...where.issueDate,
        gte: new Date(dateFrom)
      };
    }
    
    if (dateTo) {
      where.issueDate = {
        ...where.issueDate,
        lte: new Date(dateTo)
      };
    }
    
    // Add search filter
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }
    
    // Get total count for pagination
    const totalCount = await prisma.invoice.count({ where });
    
    // Build sort object - handle special cases for date fields
    let orderBy;
    // Validate sortBy field - only allow valid Invoice model fields
    const validSortFields = ['createdAt', 'updatedAt', 'issueDate', 'dueDate', 'invoiceNumber', 'total', 'status'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    orderBy = { [sortField]: sortOrder === 'asc' ? 'asc' : 'desc' };
    
    // Fetch invoices with related data
    // Fetch invoices first without items to avoid foreign key validation issues
    let invoices;
    try {
      invoices = await prisma.invoice.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          payments: {
            where: {
              status: 'Completed'
            },
            select: {
              id: true,
              amount: true,
              paymentDate: true,
              paymentMethod: true,
              reference: true,
              status: true
            }
          }
        }
      });
    } catch (queryError) {
      console.error('❌ Error fetching invoices:', queryError);
      console.error('Error details:', {
        message: queryError.message,
        stack: queryError.stack,
        name: queryError.name,
        code: queryError.code,
        meta: queryError.meta
      });
      throw queryError;
    }
    
    // Fetch items separately to handle potential data integrity issues
    const invoiceIds = invoices.map(inv => inv.id);
    let items = [];
    if (invoiceIds.length > 0) {
      try {
        items = await prisma.invoiceItem.findMany({
          where: {
            invoiceId: { in: invoiceIds }
          },
          select: {
            id: true,
            invoiceId: true,
            accountId: true,
            description: true,
            quantity: true,
            unitPrice: true,
            taxRate: true,
            amount: true,
            productId: true,
            discountAmount: true,
            discountRate: true,
            netAmount: true
          }
        });
      } catch (itemsError) {
        console.error('❌ Error fetching invoice items:', itemsError);
        console.error('Items error details:', {
          message: itemsError.message,
          stack: itemsError.stack,
          name: itemsError.name,
          code: itemsError.code
        });
        // Continue without items rather than failing completely
        items = [];
      }
    }
    
    // Group items by invoiceId
    const itemsByInvoice = items.reduce((acc, item) => {
      if (!acc[item.invoiceId]) {
        acc[item.invoiceId] = [];
      }
      acc[item.invoiceId].push(item);
      return acc;
    }, {});
    
    // Attach items to invoices
    const invoicesWithFilteredItems = invoices.map(invoice => ({
      ...invoice,
      items: itemsByInvoice[invoice.id] || []
    }));
    
    // Calculate amount due for each invoice and format response
    const invoicesWithAmountDue = invoicesWithFilteredItems.map(invoice => {
      const totalPaid = invoice.payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
      const outstandingAmount = invoice.total - totalPaid;
      const isFullyPaid = totalPaid >= invoice.total;
      const isPartiallyPaid = totalPaid > 0 && !isFullyPaid;
      
      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientId: invoice.clientId,
        client: invoice.client,
        preparedBy: invoice.createdBy?.name || 'N/A', // Include prepared by info
        preparedById: invoice.createdBy?.id || null,
        createdBy: invoice.createdBy, // Include full createdBy object
        createdAt: invoice.createdAt, // Include creation timestamp
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        discount: invoice.discount,
        subtotal: invoice.subtotal,
        taxAmount: invoice.taxAmount,
        totalDiscountAmount: invoice.totalDiscountAmount || 0, // Enhanced: Total discount amount
        total: invoice.total,
        status: invoice.status,
        notes: invoice.notes,
        items: invoice.items,
        payments: invoice.payments,
        amountDue: Math.max(0, outstandingAmount),
        totalPaid,
        paymentInfo: {
          totalPaid,
          outstandingAmount,
          isFullyPaid,
          isPartiallyPaid,
          paymentCount: invoice.payments?.length || 0
        },
        updatedAt: invoice.updatedAt
      };
    });
    
    // Return invoices with pagination metadata
    return NextResponse.json({
      invoices: invoicesWithAmountDue,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    return NextResponse.json(
      { 
        error: 'Failed to fetch invoices. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// POST - Create a new invoice
export async function POST(request) {
  try {
    const body = await request.json();
    
    console.log("🔥 INVOICE API POST ENDPOINT CALLED");
    console.log("🔥 INVOICE API RECEIVED DATA:", JSON.stringify(body, null, 2));
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Validate required fields
    if (!body.clientId || !body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Client and at least one item are required' },
        { status: 400 }
      );
    }
    
    // Enhanced validation for each item
    for (const item of body.items) {
      if (!item.description || item.quantity <= 0 || item.unitPrice < 0) {
        return NextResponse.json(
          { error: 'All items must have valid description, quantity, and unit price' },
          { status: 400 }
        );
      }

      if (!item.accountId) {
        return NextResponse.json(
          { error: 'Each invoice item must reference an income account.' },
          { status: 400 }
        );
      }
      
      // Validate per-item discount amount (should be non-negative and not exceed unit price)
      if (item.discountAmount && item.discountAmount < 0) {
        return NextResponse.json(
          { error: 'Discount amount must be positive' },
          { status: 400 }
        );
      }
      
      if (item.discountAmount && item.discountAmount > item.unitPrice) {
        return NextResponse.json(
          { error: 'Per-item discount cannot exceed unit price' },
          { status: 400 }
        );
      }
      
      // Validate tax rate
      if (item.taxRate && (item.taxRate < 0 || item.taxRate > 100)) {
        return NextResponse.json(
          { error: 'Tax rate must be between 0 and 100%' },
          { status: 400 }
        );
      }
    }
    
    const incomeAccountIds = body.items.map(item => item.accountId).filter(Boolean);
    const incomeAccounts = await prisma.account.findMany({
      where: {
        tenantId: user.tenantId,
        id: { in: incomeAccountIds },
        isActive: true,
        OR: [
          { accountType: 'Income' },
          { accountType: 'Revenue' }
        ]
      },
      select: { id: true }
    });

    if (incomeAccounts.length !== new Set(incomeAccountIds).size) {
      return NextResponse.json(
        { error: 'Invoice items must reference active income accounts.' },
        { status: 400 }
      );
    }

    // Enhanced calculation using the new function
    const calculations = calculateInvoiceTotals(body.items, body.discount || 0);
    
    // Generate invoice number with continuous sequential numbering
    // Format: INV-DDMMYYYY-00010 (date changes, but number never resets)
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const dateStr = `${day}${month}${year}`; // DDMMYYYY format
    
    // Get tenant settings for invoice prefix (optional; avoid 500 if TenantSettings has missing columns e.g. after restore)
    let tenantSettings = null;
    try {
      tenantSettings = await prisma.tenantSettings.findFirst({
        where: { tenantId: user.tenantId }
      });
    } catch (_) {
      // use default prefix below
    }
    const invoicePrefix = tenantSettings?.invoicePrefix || 'INV';
    
    // Get the last invoice for this tenant to extract the sequential number
    // The sequential number should NEVER reset, it continues infinitely
    const lastInvoice = await prisma.invoice.findFirst({
      where: {
        tenantId: user.tenantId
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        invoiceNumber: true
      }
    });
    
    let sequentialNumber = 1; // Default to 1 if no invoices exist
    
    if (lastInvoice && lastInvoice.invoiceNumber) {
      // Extract the sequential number from the last invoice
      // Format: INV-DDMMYYYY-00010 or INV-YYYYMM-001 (old format)
      const parts = lastInvoice.invoiceNumber.split('-');
      if (parts.length >= 3) {
        // Get the last part which should be the sequential number
        const lastPart = parts[parts.length - 1];
        const parsedNumber = parseInt(lastPart, 10);
        if (!isNaN(parsedNumber) && parsedNumber > 0) {
          sequentialNumber = parsedNumber + 1; // Increment by 1
        }
      }
    }
    
    // Format sequential number with 5 digits (00010, 00011, etc.)
    const sequentialNumberStr = String(sequentialNumber).padStart(5, '0');
    const invoiceNumber = `${invoicePrefix}-${dateStr}-${sequentialNumberStr}`;
    const invoiceStatus = body.status || 'Draft';
    const issueDate = new Date(body.issueDate || today);
    
    // Resolve branchId from request or user's default branch
    const branchId = await resolveBranchId(user, body.branchId, user.tenantId);
    
    // Check if invoice has service items
    const hasServices = calculations.processedItems.some(item => {
      if (!item.productId) return true; // Custom items are considered services
      // We'll check the product in the transaction
      return false; // Default to false, will check in transaction
    });
    
    // Create the invoice with items in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Check products to determine if invoice has services
      let invoiceHasServices = false;
      let productNameById = {};
      if (calculations.processedItems.some(item => item.productId)) {
        const productIds = calculations.processedItems
          .filter(item => item.productId)
          .map(item => item.productId);
        const products = await tx.product.findMany({
          where: { id: { in: productIds }, tenantId: user.tenantId },
          select: { id: true, isService: true, name: true }
        });
        productNameById = Object.fromEntries(products.map(p => [p.id, p.name]));
        invoiceHasServices = products.some(p => p.isService) ||
          calculations.processedItems.some(item => !item.productId);
      } else {
        invoiceHasServices = true; // All custom items
      }

      // Ensure every line has a clear title (item/service description)
      const itemsWithTitles = calculations.processedItems.map(item => {
        const desc = (item.description && String(item.description).trim()) || productNameById[item.productId] || 'Item';
        return { ...item, description: desc };
      });

      // Create the invoice with items
      const newInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          title: body.title || null,
          orderNumber: body.orderNumber || null,
          clientId: body.clientId,
          createdById: user.id,
          issueDate,
          dueDate: new Date(body.dueDate || new Date(today.setDate(today.getDate() + 30))),
          discount: body.discount || 0, // Legacy global discount
          subtotal: calculations.subtotal,
          taxAmount: calculations.taxAmount,
          totalDiscountAmount: calculations.totalDiscountAmount, // Enhanced: Total of all line item discounts
          total: calculations.total,
          status: invoiceStatus,
          notes: body.notes,
          tenantId: user.tenantId,
          branchId: branchId,
          footerPhoneOverride: body.footerPhoneOverride || null,
          footerBankDetailsOverride: body.footerBankDetailsOverride || null,
          items: {
            create: itemsWithTitles.map(item => ({
              description: item.description,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              taxRate: Number(item.taxRate || 0),
              discountRate: 0, // Legacy field, keep for backward compatibility
              discountAmount: Number(item.discountAmount || 0),
              netAmount: Number(item.netAmount || 0),
              amount: Number(item.amount),
              productId: item.productId || null,
              accountId: item.accountId // Use direct field assignment instead of relation connect
            }))
          }
        },
        include: {
          client: true,
          createdBy: { // Include user info for "Prepared By"
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          items: true
        }
      });

      // Create journal entry if invoice is not a draft
      if (invoiceStatus !== 'Draft') {
        try {
          // Calculate total COGS for all inventory items
          let totalCOGS = 0;
          let productsWithoutCost = [];
          
          for (const item of calculations.processedItems) {
            if (item.productId) {
              try {
                // Check if product is a service (services don't have COGS)
                const product = await tx.product.findUnique({
                  where: { id: item.productId },
                  select: { id: true, isService: true, cost: true, averageCost: true }
                });
                
                // Only calculate COGS and deduct stock for non-service products
                if (product && !product.isService) {
                  const cogsData = await calculateCOGS({
                    productId: item.productId,
                    tenantId: user.tenantId,
                    quantitySold: item.quantity,
                    tx,
                  });
                  
                  console.log(`📊 COGS Calculation for product ${item.productId}:`, {
                    quantitySold: item.quantity,
                    unitCost: cogsData.unitCost,
                    cogsAmount: cogsData.cogsAmount,
                    remainingQuantity: cogsData.remainingQuantity
                  });
                  
                  totalCOGS += cogsData.cogsAmount;
                  
                  if (cogsData.cogsAmount === 0 && item.quantity > 0) {
                    productsWithoutCost.push({
                      productId: item.productId,
                      description: item.description,
                      quantity: item.quantity,
                      unitPrice: item.unitPrice
                    });
                  }
                  // Deduct stock when invoice is posted (reversal will restore)
                  const qty = Number(item.quantity) || 0;
                  if (qty > 0) {
                    await tx.product.update({
                      where: { id: item.productId },
                      data: { stockLevel: { decrement: qty } }
                    });
                    try {
                      await tx.inventoryTransaction.create({
                        data: {
                          productId: item.productId,
                          type: 'invoice',
                          quantity: -Math.round(qty), // Int: negative = deduction
                          notes: `Invoice ${invoiceNumber}`,
                          userId: user.id,
                          tenantId: user.tenantId
                        }
                      });
                    } catch (e) {
                      if (!e.message?.includes('Unknown model')) console.warn('InventoryTransaction for invoice:', e?.message);
                    }
                  }
                }
              } catch (cogsError) {
                console.error(`Error calculating COGS for product ${item.productId}:`, cogsError);
                // Continue with other items
              }
            }
          }

          console.log(`📊 Total COGS for invoice ${invoiceNumber}: MK ${totalCOGS}`);
          
          // Log warning if there are products without cost
          if (productsWithoutCost.length > 0) {
            console.warn(`⚠️ ${productsWithoutCost.length} products have no cost information:`, productsWithoutCost);
          }

          // Create invoice journal entry (revenue + COGS, without tax — tax posted separately per type)
          await createInvoiceJournalEntry({
            tenantId: user.tenantId,
            userId: user.id,
            invoiceId: newInvoice.id,
            invoiceNumber,
            issueDate,
            totalAmount: calculations.total,
            items: calculations.processedItems,
            hasServices: invoiceHasServices,
            cogsAmount: totalCOGS,
            taxAmount: 0, // Tax handled separately below
            taxTypeId: null,
            tx,
          });

          // Post tax per tax type from item data
          if (calculations.taxAmount > 0) {
            const { autoPostTaxEntry } = await import('@/lib/taxCalculationService');

            // Group items by tax type and sum their tax amounts
            const taxByType = {};
            for (const item of calculations.processedItems) {
              const taxTypeId = item.selectedTaxTypeId;
              if (taxTypeId && Number(item.taxAmount) > 0) {
                if (!taxByType[taxTypeId]) taxByType[taxTypeId] = { taxTypeId, totalTax: 0 };
                taxByType[taxTypeId].totalTax += Number(item.taxAmount);
              }
            }

            const perTypeTaxTotal = Object.values(taxByType).reduce((s, t) => s + t.totalTax, 0);

            // Post tax for each identified tax type
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
                console.warn(`Failed to post tax for type ${taxTypeId} on invoice ${invoiceNumber}:`, taxPostErr?.message);
              }
            }

            // Fallback: if no per-item taxTypeId but invoice has tax, use rate-matching
            const unmatchedTax = calculations.taxAmount - perTypeTaxTotal;
            if (unmatchedTax > 0.01) {
              try {
                const activeTaxTypes = await tx.taxType.findMany({
                  where: { tenantId: user.tenantId, status: 'Active' },
                });
                const nonPayeTypes = activeTaxTypes.filter(t => Number(t.taxRate) > 0);
                const itemTaxRates = calculations.processedItems
                  .map(i => Number(i.taxRate || 0))
                  .filter(r => r > 0);
                const primaryRate = itemTaxRates.length > 0 ? itemTaxRates[0] : 0;
                let fallbackTaxTypeId = null;
                if (primaryRate > 0) {
                  fallbackTaxTypeId = nonPayeTypes.find(t => Math.abs(Number(t.taxRate) - primaryRate) < 0.01)?.id
                    || nonPayeTypes[0]?.id || null;
                } else {
                  fallbackTaxTypeId = nonPayeTypes[0]?.id || null;
                }
                if (fallbackTaxTypeId) {
                  await autoPostTaxEntry({
                    tenantId: user.tenantId,
                    userId: user.id,
                    taxTypeId: fallbackTaxTypeId,
                    taxAmount: unmatchedTax,
                    transactionDate: issueDate,
                    sourceType: 'Invoice',
                    sourceId: newInvoice.id,
                    description: `Tax for invoice ${invoiceNumber} (fallback)`,
                    tx,
                  });
                }
              } catch (fallbackErr) {
                console.warn('Could not post fallback tax for invoice:', fallbackErr?.message);
              }
            }
          }
          
          console.log(`✅ Journal entry created for invoice ${invoiceNumber} with COGS: MK ${totalCOGS}, tax: MK ${calculations.taxAmount}`);
        } catch (journalError) {
          console.error('Error creating journal entry for invoice:', journalError);
          throw journalError;
        }
      }

      // Create audit log entry
      await tx.auditLog.create({
      data: {
        action: 'INVOICE_CREATED',
        entityType: 'INVOICE',
        entityId: newInvoice.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          invoiceNumber,
          client: newInvoice.client.name,
          amount: newInvoice.total
        })
      }
    });

      return newInvoice;
    });

    const newInvoice = result;
    
    // Format the response
    const formattedInvoice = {
      id: newInvoice.id,
      invoiceNumber: newInvoice.invoiceNumber,
      clientId: newInvoice.clientId,
      client: newInvoice.client,
      preparedBy: newInvoice.createdBy?.name || 'N/A', // Include prepared by info
      preparedById: newInvoice.createdBy?.id || null,
      createdBy: newInvoice.createdBy, // Include full createdBy object
      createdAt: newInvoice.createdAt, // Include creation timestamp
      issueDate: newInvoice.issueDate,
      dueDate: newInvoice.dueDate,
      discount: newInvoice.discount,
      subtotal: newInvoice.subtotal,
      taxAmount: newInvoice.taxAmount,
      totalDiscountAmount: newInvoice.totalDiscountAmount,
      total: newInvoice.total,
      status: newInvoice.status,
      notes: newInvoice.notes,
      items: newInvoice.items,
      updatedAt: newInvoice.updatedAt
    };
    
    // Return the created invoice
    return NextResponse.json(
      { 
        message: 'Invoice created successfully',
        invoice: formattedInvoice
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('❌ Error creating invoice:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      meta: error.meta
    });

    // Period lock: return 403 with a clear message so the UI can show it
    if (error.code === 'PERIOD_LOCKED') {
      const base = error.message || `Cannot post in closed accounting period: ${error.period?.periodName || 'unknown'}.`;
      const message = base.includes('Reopen') ? base : `${base} Reopen the period in Accounting Periods to post this invoice.`;
      return NextResponse.json(
        {
          error: message,
          details: { code: 'PERIOD_LOCKED', periodName: error.period?.periodName }
        },
        { status: 403 }
      );
    }
    
    // Generic server error
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? `Failed to create invoice: ${error.message}` 
      : 'Failed to create invoice. Please try again.';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? {
          code: error.code,
          meta: error.meta
        } : undefined
      },
      { status: 500 }
    );
  }
}