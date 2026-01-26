// app/api/sales/route.js - Enhanced with Project B's business logic
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { updateAccountBalance } from '@/lib/core';
import { consumeFifoForSale } from '@/lib/fifoCosting';
import { createSaleJournalEntries } from '@/lib/transactionJournalHelpers';

// Helper function to format currency
const formatCurrency = (amount) => {
  return `MK ${typeof amount === 'number' 
    ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : amount}`;
};

// Helper function to normalize payment method for AccountBalance
const normalizePaymentMethod = (method) => {
  if (!method) return 'cash';
  const methodStr = method.toString().trim();
  
  // If it's already a normalized key (contains underscore), return as is
  if (methodStr.includes('_')) {
    return methodStr.toLowerCase();
  }
  
  // If it looks like an account ID (CUID format: starts with letters, no spaces, long string), don't normalize
  // CUIDs are typically 25 characters, alphanumeric, no spaces
  if (methodStr.length > 20 && /^[a-z0-9]+$/i.test(methodStr) && !methodStr.includes(' ')) {
    return methodStr; // Likely an account ID, return as is
  }
  
  // Otherwise normalize: "Bank Transfer" -> "bank_transfer", "PayChangu" -> "paychangu", "Mpamba" -> "mpamba"
  return methodStr.toLowerCase().replace(/\s+/g, '_') || 'cash';
};

// GET - Fetch sales with filtering, sorting, and pagination
export async function GET(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const status = searchParams.get('status');
    const clientId = searchParams.get('clientId');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    
    // Check if the Sale model exists in Prisma
    if (!prisma.sale) {
      console.error("Sale model not found in Prisma client. Returning mock data.");
      
      // Return mock data as a fallback
      return NextResponse.json({
        sales: [
          { 
            id: "mock-1", 
            saleNumber: "SL-001", 
            date: "2025-03-07", 
            client: "Walk-in Customer", 
            clientId: null,
            createdBy: "Admin",
            subtotal: "120,000.00",
            taxAmount: "19,800.00",
            total: "139,800.00", 
            taxRate: 16.5,
            status: "completed",
            paymentMethod: "cash",
            notes: null,
            itemCount: 3,
            createdAt: new Date().toISOString(),
            rawTotal: 139800,
            rawSubtotal: 120000
          },
          { 
            id: "mock-2", 
            saleNumber: "SL-002", 
            date: "2025-03-06", 
            client: "Acme Corp", 
            clientId: "mock-client-1",
            createdBy: "Admin",
            subtotal: "450,000.00",
            taxAmount: "74,250.00",
            total: "524,250.00", 
            taxRate: 16.5,
            status: "completed",
            paymentMethod: "card",
            notes: null,
            itemCount: 5,
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            rawTotal: 524250,
            rawSubtotal: 450000
          }
        ],
        pagination: {
          page,
          limit,
          totalCount: 2,
          totalPages: 1
        }
      });
    }
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Build filter object for Prisma
    const where = {
      tenantId: user.tenantId, // Filter by tenant ID for multi-tenancy
    };
    
    // Add branch filter - use provided branchId or user's current branch
    const branchId = searchParams.get('branchId');
    if (branchId) {
      where.branchId = branchId;
    } else if (user?.currentBranchId) {
      // Auto-filter by user's current branch if no branchId provided
      where.branchId = user.currentBranchId;
    }
    
    // Add status filter if provided
    if (status) {
      where.status = status;
    }
    
    // Add client filter if provided
    if (clientId) {
      where.clientId = clientId;
    }
    
    // Add date range filter if provided
    if (dateFrom || dateTo) {
      where.saleDate = {};
      if (dateFrom) {
        where.saleDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.saleDate.lte = new Date(dateTo);
      }
    }
    
    // Add search filter if provided
    if (search) {
      where.OR = [
        { saleNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }
    
    // Get total count for pagination
    const totalCount = await prisma.sale.count({ where });
    
    // Build sort object for Prisma
    const orderBy = { [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' };
    
    // Fetch sales with related data
    const sales = await prisma.sale.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        client: {
          select: {
            id: true,
            name: true,
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      }
    });
    
    // Format the sales data for the response
    const formattedSales = sales.map(sale => {
      const productSummary = sale.items.map(item => {
        const label = item.product?.name || item.description || 'Item';
        const qty = typeof item.quantity === 'number' ? item.quantity : Number(item.quantity) || 0;
        return `${label} (x${qty})`;
      }).join(', ');
      
      return {
        id: sale.id,
        saleNumber: sale.saleNumber,
        date: sale.saleDate.toISOString().split('T')[0],
        client: sale.client ? sale.client.name : 'Walk-in Customer',
        clientId: sale.clientId,
        createdBy: sale.createdBy.name,
        productSummary,
        subtotal: sale.subtotal.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        taxAmount: sale.taxAmount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        total: sale.total.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        discount: sale.discount,
        taxRate: sale.taxRate,
        status: sale.status,
        paymentMethod: sale.paymentMethod,
        notes: sale.notes,
        itemCount: sale.items.length,
        createdAt: sale.createdAt.toISOString(),
        // Include raw numeric values for sorting and calculations
        rawTotal: sale.total,
        rawSubtotal: sale.subtotal,
        // Historical transaction metadata
        isHistorical: sale.isHistorical || false,
        historicalDate: sale.historicalDate ? sale.historicalDate.toISOString().split('T')[0] : null,
        migrationBatch: sale.migrationBatch,
        originalReference: sale.originalReference
      };
    });
    
    // Return sales with pagination metadata
    return NextResponse.json({
      sales: formattedSales,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    
    // Return empty data with an error message
    return NextResponse.json({
      sales: [],
      pagination: {
        page: 1,
        limit: 10,
        totalCount: 0,
        totalPages: 0
      },
      error: 'Failed to fetch sales. Please try again.'
    });
  }
}

// POST - Create a new sale (Enhanced with Project B's business logic)
export async function POST(request) {
  console.log('🔥 SALES API POST ENDPOINT CALLED');
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const data = await request.json();
    console.log('🔥 BACKEND: SALES API RECEIVED DATA');
    console.log('🔥 BACKEND: Received sale data:', JSON.stringify(data, null, 2));
    console.log('🔥 BACKEND: Items with unit quantities:', data.items?.filter(item => item.unitQuantities));
    console.log('🔥 BACKEND: ================================');
    
    // Validate required fields
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      return NextResponse.json(
        { error: 'Sale must include at least one item' },
        { status: 400 }
      );
    }
    
    // Enhanced validation: Check that all items have required fields
    // Now supports custom products (productId can be null)
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      
      if (!item.description || !item.quantity || !item.unitPrice) {
        return NextResponse.json(
          { 
            error: `Item ${i + 1}: description, quantity, and unitPrice are required`,
            details: `Missing fields in item: ${JSON.stringify(item)}`
          },
          { status: 400 }
        );
      }

      // For non-custom products, validate productId exists
      if (!item.isCustom && item.productId) {
        try {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
            select: { id: true, stockLevel: true, name: true }
          });
          
          if (!product) {
            return NextResponse.json(
              { error: `Product with ID ${item.productId} not found` },
              { status: 400 }
            );
          }
        } catch (productError) {
          console.error('Error validating product:', productError);
          return NextResponse.json(
            { error: `Invalid product ID: ${item.productId}` },
            { status: 400 }
          );
        }
      }
    }
    
    // Enhanced calculation: Handle individual item taxes and discounts
    let subtotal = 0;
    let totalTaxAmount = 0;
    let totalDiscountAmount = 0;

    data.items.forEach(item => {
      const itemSubtotal = item.quantity * item.unitPrice;
      subtotal += itemSubtotal;
      totalTaxAmount += item.taxAmount || 0;
      totalDiscountAmount += item.discountAmount || 0;
    });

    // Include optional global discount from payload (fallback to 0)
    const globalDiscount = Number(data.globalDiscount || 0);
    const total = subtotal + totalTaxAmount - totalDiscountAmount - globalDiscount;

    // Backward compatibility: if old taxRate is provided, use it
    const legacyTaxRate = data.taxRate || 0;
    const legacyTaxAmount = subtotal * (legacyTaxRate / 100);
    
    // Use individual item taxes if available, otherwise use legacy tax calculation
    const finalTaxAmount = totalTaxAmount > 0 ? totalTaxAmount : legacyTaxAmount;
    const finalTotal = totalTaxAmount > 0 
      ? total 
      : (subtotal + legacyTaxAmount - totalDiscountAmount - globalDiscount);
    
    // Generate sale number (e.g., SALE-20250322-001)
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Get count of sales for today to generate sequential number
    const salesCount = await prisma.sale.count({
      where: {
        tenantId: user.tenantId,
        createdAt: {
          gte: new Date(today.setHours(0, 0, 0, 0))
        }
      }
    });
    
    const saleNumber = `SALE-${dateStr}-${(salesCount + 1).toString().padStart(3, '0')}`;
    
    try {
      // Log the incoming data
      console.log('🔥🔥🔥 SALES API POST - INCOMING DATA 🔥🔥🔥');
      console.log('Status from request:', data.status);
      console.log('Full data object:', JSON.stringify(data, null, 2));
      
      // Create the sale in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Determine the actual status (default to 'completed' if not specified)
        const saleStatus = data.status || 'completed';
        console.log('🔥 Determined saleStatus:', saleStatus);
        
        // First, check inventory if sale is being completed
        if (saleStatus === 'completed') {
          // Check if all non-custom products have sufficient stock
          for (const item of data.items) {
            // Skip custom products
            if (item.isCustom || !item.productId) {
              continue;
            }
            
            const product = await tx.product.findUnique({
              where: { id: item.productId },
              select: { id: true, name: true, stockLevel: true }
            });
            
            if (!product) {
              throw new Error(`Product with ID ${item.productId} not found`);
            }
            
            // Skip check if stockLevel is null (unlimited)
            if (product.stockLevel !== null && product.stockLevel < item.quantity) {
              throw new Error(`Insufficient stock for "${product.name}". Available: ${product.stockLevel}, Requested: ${item.quantity}`);
            }
          }
        }
        
        // Validate branchId if provided (must belong to user's tenant)
        let branchId = data.branchId || null;
        if (branchId) {
          const branch = await tx.branch.findFirst({
            where: { id: branchId, tenantId: user.tenantId, isActive: true }
          });
          if (!branch) {
            throw new Error('Invalid or inactive branch selected');
          }
        }

        // Create the sale with enhanced fields
        const sale = await tx.sale.create({
          data: {
            saleNumber,
            saleDate: data.saleDate ? new Date(data.saleDate) : new Date(),
            subtotal,
            // Enhanced: Store individual tax amounts
            totalTaxAmount: finalTaxAmount,
            totalDiscountAmount: totalDiscountAmount + globalDiscount,
            total: finalTotal,
            status: saleStatus,
            paymentMethod: data.paymentMethod || 'cash',
            notes: data.notes,
            // Backward compatibility: keep legacy taxRate and taxAmount
            taxRate: legacyTaxRate,
            taxAmount: legacyTaxAmount,
            // Historical transaction fields
            isHistorical: data.isHistorical || false,
            historicalDate: data.isHistorical && data.historicalDate ? new Date(data.historicalDate) : null,
            migrationBatch: data.migrationBatch || null,
            originalReference: data.originalReference || null,
            // Connect to branch if provided
            ...(branchId ? {
              branch: {
                connect: { id: branchId }
              }
            } : {}),
            // Connect to client if provided
            ...(data.clientId ? {
              client: {
                connect: { id: data.clientId }
              }
            } : {}),
            // Connect to user & tenant
            createdBy: {
              connect: { id: user.id }
            },
            tenant: {
              connect: { id: user.tenantId }
            }
          }
        });
        
        // Create sale items with enhanced fields
        const items = await Promise.all(
          data.items.map(async (item) => {
            // Calculate item amount
            const amount = item.quantity * item.unitPrice;
            
            // Create the sale item with enhanced fields
            const saleItemData = {
              sale: {
                connect: { id: sale.id }
              },
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: amount,
              // Enhanced fields
              taxRate: item.taxRate || 0,
              taxAmount: item.taxAmount || 0,
              taxDescription: item.taxDescription || null,
              discount: item.discount || 0,
              discountAmount: item.discountAmount || 0,
              isCustom: item.isCustom || false,
              customProductData: item.customProductData || null
            };

            // Connect to product only if it's not a custom product
            if (!item.isCustom && item.productId) {
              saleItemData.product = {
                connect: { id: item.productId }
              };
            }
            
            return tx.saleItem.create({
              data: saleItemData
            });
          })
        );
        
        // Update inventory if status is completed
        if (saleStatus === 'completed') {
          await Promise.all(
            data.items
              .filter(item => !item.isCustom && item.productId) // Only non-custom products
              .map(async (item) => {
                // Create inventory transaction
                await tx.inventoryTransaction.create({
                  data: {
                    productId: item.productId,
                    type: 'sale',
                    quantity: -item.quantity, // Negative for stock reduction
                    notes: `Sale ${saleNumber}`,
                    userId: user.id,
                    tenantId: user.tenantId
                  }
                });

                // Check if product has unit management enabled
                const productWithUnits = await tx.product.findUnique({
                  where: { id: item.productId },
                  include: {
                    productUnits: {
                      include: {
                        unit: true
                      }
                    }
                  }
                });
                
                console.log("🔥 BACKEND: PRODUCT UNITS CHECK");
                console.log("🔥 BACKEND: Product ID:", item.productId);
                console.log("🔥 BACKEND: Product has units:", productWithUnits?.productUnits?.length > 0);
                console.log("🔥 BACKEND: Product units count:", productWithUnits?.productUnits?.length || 0);
                console.log("🔥 BACKEND: Unit quantities in item:", item.unitQuantities);
                console.log("🔥 BACKEND: ==========================");

                if (productWithUnits?.productUnits && productWithUnits.productUnits.length > 0) {
                  // Handle unit-based stock reduction
                  const unitQuantities = item.unitQuantities || {};
                  
                  console.log("=== SALES API STOCK REDUCTION DEBUG ===");
                  console.log("Product ID:", item.productId);
                  console.log("Product name:", productWithUnits.name);
                  console.log("Unit quantities received:", unitQuantities);
                  console.log("Product units:", productWithUnits.productUnits);
                  
                  // Calculate total quantity in base units (same logic as frontend)
                  let totalBaseQuantity = 0;
                  Object.entries(unitQuantities).forEach(([unitId, qty]) => {
                    const unit = productWithUnits.productUnits.find(pu => pu.unit.id === unitId);
                    if (unit && qty > 0) {
                      const conversionRate = parseFloat(unit.unit.conversionToBase);
                      const convertedToBase = unit.unit.isBaseUnit ? qty : qty / conversionRate;
                      totalBaseQuantity += convertedToBase;
                      console.log(`Unit ${unit.unit.symbol}: ${qty} = ${convertedToBase.toFixed(6)} base units`);
                    }
                  });
                  
                  console.log("Total base quantity to reduce:", totalBaseQuantity.toFixed(6));
                  console.log("=====================================");
                  
                  // Reduce from main product stock (base unit logic)
                  await tx.product.update({
                    where: { id: item.productId },
                    data: {
                      stockLevel: {
                        decrement: totalBaseQuantity
                      }
                    }
                  });
                  
                  console.log(`Reduced ${totalBaseQuantity} from main product stock`);
                  
                  // For unit-managed products, we only reduce the main product stock
                  // The individual unit stocks are calculated from the main stock
                  // This ensures consistency across all displays
                } else {
                  // Handle regular product stock reduction
                  return tx.product.update({
                    where: { id: item.productId },
                    data: {
                      stockLevel: {
                        decrement: item.quantity
                      }
                    }
                  });
                }
              })
          );

          // 🔐 Create payment record for completed sale
          // Use sale date for paymentDate (historicalDate if set, otherwise saleDate)
          // This ensures historical sales are recorded with their actual sale date
          const paymentDate = sale.historicalDate || sale.saleDate;
          
          const paymentMethodInput = data.paymentMethod || 'cash';
          
          const newPayment = await tx.payment.create({
            data: {
              saleId: sale.id,
              amount: finalTotal,
              paymentDate: paymentDate, // Use sale date instead of current date
              paymentMethod: paymentMethodInput,
              reference: `Sale ${saleNumber}`,
              notes: data.notes || `Payment for sale ${saleNumber}`,
              status: 'Completed',
              tenantId: user.tenantId,
              type: 'sale',
              sourceAccount: paymentMethodInput
            }
          });

          // Update account balance for the payment method
          // Normalize payment method to match AccountBalance format (e.g., "Mpamba" -> "mpamba", "Airtel Money" -> "airtel_money")
          const normalizedPaymentMethod = normalizePaymentMethod(paymentMethodInput);
          await updateAccountBalance(
            user.tenantId,
            normalizedPaymentMethod,
            Number(finalTotal),
            'add',
            tx
          );

          // Create journal entries for sale (Revenue + COGS)
          // Note: Account balances are updated automatically when transactions are created
          console.log('🔥🔥🔥 JOURNAL ENTRY CREATION STARTING 🔥🔥🔥');
          console.log('Sale status:', saleStatus);
          console.log('Sale ID:', sale.id);
          console.log('Sale Number:', saleNumber);
          console.log('Total Amount:', finalTotal);
          try {
            // Calculate total COGS for all inventory items
            // Use the created 'items' array (with database IDs) instead of 'data.items'
            let totalCOGS = 0;
            const hasServices = items.some(item => item.isCustom || !item.productId);

            // Match data.items with created items by index (they should be in the same order)
            for (let i = 0; i < data.items.length; i++) {
              const dataItem = data.items[i];
              const saleItem = items[i];
              
              if (!saleItem) {
                console.warn(`SaleItem not found at index ${i}`);
                continue;
              }

              if (dataItem.productId && !dataItem.isCustom) {
                try {
                  // Check if product is a service (services don't have COGS)
                  const product = await tx.product.findUnique({
                    where: { id: dataItem.productId },
                    select: { 
                      id: true, 
                      isService: true,
                      name: true,
                      stockLevel: true,
                      branchId: true
                    }
                  });
                  
                  // Only calculate COGS for non-service products
                  if (product && !product.isService) {
                    // Get product cost at time of sale (to store for fallback if FIFO fails)
                    const productAtSaleTime = await tx.product.findUnique({
                      where: { id: dataItem.productId },
                      select: { cost: true }
                    });
                    const productCostAtSale = productAtSaleTime?.cost ? Number(productAtSaleTime.cost) : 0;
                    
                    // Try FIFO consumption - it will handle branch fallback internally
                    let itemCOGS = 0;
                    try {
                      const fifo = await consumeFifoForSale({
                        tenantId: user.tenantId,
                        // IMPORTANT: batches are created with the product's branchId (when branch-scoped),
                        // so prefer product.branchId for FIFO matching. Using sale.branchId first can cause
                        // "no batches found" and silently fall back to productCostAtSale.
                        branchId: product.branchId || sale.branchId || null,
                        productId: dataItem.productId,
                        quantitySold: dataItem.quantity,
                        saleId: sale.id,
                        saleItemId: saleItem.id, // Use the actual database ID from created sale item
                        tx,
                      });

                      // Persist read-only COGS details on the SaleItem payload (system-only)
                      // Uses existing JSON field to avoid schema changes on SaleItem.
                      // Ensure cogsAmount is stored as a plain number (not Decimal)
                      const cogsAmountValue = typeof fifo.cogsAmount === 'object' && fifo.cogsAmount?.toNumber 
                        ? fifo.cogsAmount.toNumber() 
                        : Number(fifo.cogsAmount);
                      
                      itemCOGS = cogsAmountValue;
                      console.log(`[FIFO Sale] ✅ Calculated FIFO COGS: ${cogsAmountValue} for ${dataItem.quantity} units`);
                      console.log(`[FIFO Sale] Allocations:`, fifo.allocations.map(a => `${a.quantity} @ ${a.unitCost} = ${a.cogsAmount}`).join(', '));
                      
                      await tx.saleItem.update({
                        where: { id: saleItem.id },
                        data: {
                          customProductData: {
                            ...(saleItem.customProductData || {}),
                            fifoCogs: {
                              cogsAmount: cogsAmountValue,
                              allocations: fifo.allocations.map(alloc => ({
                                batchId: alloc.batchId,
                                quantity: typeof alloc.quantity === 'object' && alloc.quantity?.toNumber 
                                  ? alloc.quantity.toNumber() 
                                  : Number(alloc.quantity),
                                unitCost: typeof alloc.unitCost === 'object' && alloc.unitCost?.toNumber 
                                  ? alloc.unitCost.toNumber() 
                                  : Number(alloc.unitCost),
                                cogsAmount: typeof alloc.cogsAmount === 'object' && alloc.cogsAmount?.toNumber
                                  ? alloc.cogsAmount.toNumber() 
                                  : Number(alloc.cogsAmount),
                              })),
                            },
                            // Store product cost at time of sale for fallback
                            productCostAtSale: productCostAtSale,
                          },
                        },
                      });
                      
                      console.log(`[FIFO Sale] ✅ FIFO COGS stored in customProductData for SaleItem ${saleItem.id}: ${cogsAmountValue}`);
                    } catch (fifoError) {
                      console.error(`[FIFO Sale] ❌ Error calculating FIFO COGS for product ${dataItem.productId}:`, fifoError);
                      console.error('[FIFO Sale] Error details:', {
                        message: fifoError.message,
                        stack: fifoError.stack,
                        productId: dataItem.productId,
                        quantity: dataItem.quantity,
                        branchId: product.branchId || sale.branchId || null
                      });
                      
                      // FIFO failed - use product cost at sale time as fallback
                      itemCOGS = dataItem.quantity * productCostAtSale;
                      console.warn(`[FIFO Sale] ⚠️ Using product cost at sale time as fallback: ${productCostAtSale} × ${dataItem.quantity} = ${itemCOGS}`);
                      
                      // Store product cost at sale time for fallback calculation
                      await tx.saleItem.update({
                        where: { id: saleItem.id },
                        data: {
                          customProductData: {
                            ...(saleItem.customProductData || {}),
                            productCostAtSale: productCostAtSale,
                          },
                        },
                      });
                      console.log(`[FIFO Sale] Stored product cost at sale time: ${productCostAtSale} for fallback COGS calculation`);
                    }
                    
                    // Add to total COGS (either from FIFO or fallback)
                    totalCOGS += itemCOGS;
                    console.log(`[FIFO Sale] Total COGS after this item: ${totalCOGS} (item COGS: ${itemCOGS})`);
                  }
                } catch (cogsError) {
                  console.error(`❌ Error in COGS calculation block for product ${dataItem.productId}:`, cogsError);
                  console.error('COGS Error details:', {
                    message: cogsError.message,
                    stack: cogsError.stack
                  });
                  // Continue with other items
                }
              }
            }

            // Create journal entries
            console.log('🔥 About to create journal entries for sale:', sale.id);
            console.log('💰 COGS Summary:', {
              totalCOGS,
              itemCount: data.items.length,
              inventoryItems: data.items.filter(item => item.productId && !item.isCustom).length
            });
            const journalEntries = await createSaleJournalEntries({
              tenantId: user.tenantId,
              userId: user.id,
              saleId: sale.id,
              saleNumber,
              saleDate: paymentDate,
              totalAmount: finalTotal,
              paymentMethod: data.paymentMethod || 'cash',
              hasServices,
              cogsAmount: totalCOGS,
              tx,
            });
            console.log('✅ Journal entries created successfully:', journalEntries.length);
            if (totalCOGS > 0) {
              console.log('✅ COGS should have been recorded:', totalCOGS);
            } else {
              console.log('⚠️ No COGS to record (totalCOGS = 0)');
            }
          } catch (journalError) {
            console.error('❌ Error creating journal entries for sale:', journalError);
            console.error('Journal error details:', {
              message: journalError.message,
              stack: journalError.stack,
              saleId: sale.id,
              tenantId: user.tenantId,
              errorName: journalError.name,
            });
            // IMPORTANT: We're catching the error but not re-throwing it
            // This means the sale will be created even if journal entry fails
            // Check the console logs above to see what went wrong
          }
        }
        
        // Create sale state history record
        try {
          await tx.saleStateHistory.create({
            data: {
              saleId: sale.id,
              fromStatus: 'draft',
              toStatus: saleStatus,
              reason: saleStatus === 'draft' ? 'Sale saved as draft' : 'Sale completed',
              changedById: user.id
            }
          });
        } catch (historyError) {
          console.log('SaleStateHistory table not available, skipping history record');
          // Continue without failing the transaction
        }
        
        // Create audit log with historical transaction details
        await tx.auditLog.create({
          data: {
            action: data.isHistorical ? 'HISTORICAL_SALE_CREATED' : 'SALE_CREATED',
            entityType: 'SALE',
            entityId: sale.id,
            userId: user.id,
            tenantId: user.tenantId,
            details: JSON.stringify({
              saleNumber: sale.saleNumber,
              total: sale.total,
              status: sale.status,
              items: data.items.length,
              customItems: data.items.filter(item => item.isCustom).length,
              isHistorical: data.isHistorical || false,
              historicalDate: data.historicalDate || null,
              migrationBatch: data.migrationBatch || null,
              originalReference: data.originalReference || null
            })
          }
        });
        
        return { sale, items };
      });
      
      // Return the created sale with formatted data
      return NextResponse.json({
        message: 'Sale created successfully',
        sale: {
          id: result.sale.id,
          saleNumber: result.sale.saleNumber,
          date: result.sale.saleDate.toISOString().split('T')[0],
          subtotal: formatCurrency(result.sale.subtotal),
          totalTaxAmount: formatCurrency(result.sale.totalTaxAmount || 0),
          totalDiscountAmount: formatCurrency(result.sale.totalDiscountAmount || 0),
          tax: formatCurrency(result.sale.totalTaxAmount || result.sale.taxAmount), // Backward compatibility
          total: formatCurrency(result.sale.total),
          status: result.sale.status,
          paymentMethod: result.sale.paymentMethod,
          itemCount: result.items.length,
          customItemCount: data.items.filter(item => item.isCustom).length
        }
      }, { status: 201 });
    } catch (error) {
      // Handle inventory or database errors
      if (error.message.includes("Insufficient stock")) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      } else if (error.message.includes("not found")) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      } else {
        console.error('Transaction error:', error);
        throw error; // Re-throw for general error handling
      }
    }
  } catch (error) {
    console.error('Error creating sale:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create sale. Please try again.',
        details: error.message 
      },
      { status: 500 }
    );
  }
}