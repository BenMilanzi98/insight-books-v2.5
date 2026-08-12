// app/api/inventory/transactions/route.js - Emergency fix
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { createInventoryWriteOffJournalEntry } from '@/lib/inventoryWriteOffJournal';
import { completeOpeningStockWizardStep } from '@/lib/setupWizardService';
import { postOpeningBalance } from '@/lib/openingBalanceService';
import { roundMoney } from '@/lib/money';
import { AccountingV2Error } from '@/lib/accountingV2/domain/errors.js';

function branchProductWhere(tenantId, currentBranchId) {
  if (!currentBranchId) return { tenantId };
  return {
    tenantId,
    OR: [{ branchId: currentBranchId }, { branchId: null }],
  };
}

// In-memory request deduplication cache (prevents double processing)
// Key: `${userId}-${productId}-${type}-${quantity}-${unitCost}`
// Value: timestamp of when request was processed
const requestCache = new Map();
const CACHE_TTL = 10000; // 10 seconds

function getRequestKey(userId, productId, type, quantity, unitCost) {
  // Don't include timestamp - we want to catch duplicates regardless of when they arrive
  // Use a stable key based on request parameters
  return `${userId}-${productId}-${type}-${quantity}-${unitCost || 0}`;
}

function isDuplicateRequest(key) {
  const now = Date.now();
  
  // Check if this exact request was processed recently
  if (requestCache.has(key)) {
    const cachedTime = requestCache.get(key);
    if (now - cachedTime < CACHE_TTL) {
      console.warn(`[Stock Transaction] Duplicate request detected: ${key} (processed ${now - cachedTime}ms ago)`);
      return true; // Duplicate request within TTL window
    }
  }
  
  // Cache this request
  requestCache.set(key, now);
  
  // Clean up old entries (older than TTL) periodically
  if (requestCache.size > 100) { // Only clean when cache gets large
    for (const [k, v] of requestCache.entries()) {
      if (now - v > CACHE_TTL) {
        requestCache.delete(k);
      }
    }
  }
  
  return false;
}

// Helper function to check if a model exists
async function doesModelExist(modelName) {
  try {
    const model = prisma[modelName];
    if (!model || typeof model.findFirst !== 'function') {
      console.warn(`Model ${modelName} does not exist on Prisma client`);
      return false;
    }
    await model.findFirst({
      take: 1,
      select: { id: true }
    });
    return true;
  } catch (error) {
    console.warn(`Model ${modelName} is not accessible:`, error.message);
    return false;
  }
}

// GET - Fetch inventory transactions or mock data if model doesn't exist
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
    const productId = searchParams.get('productId');
    
    // Check if InventoryTransaction model exists
    const modelExists = await doesModelExist('inventoryTransaction');
    
    if (!modelExists) {
      // Query audit logs for inventory transactions
      const whereClause = {
        tenantId: user.tenantId,
        entityType: 'PRODUCT',
        action: { in: ['INVENTORY_STOCK_IN', 'INVENTORY_STOCK_OUT', 'INVENTORY_ADJUSTMENT'] }
      };
      
      // Add branch filtering - include tenant-wide (null branch) products
      if (user?.currentBranchId && productId) {
        // If filtering by productId, check if product belongs to branch or is tenant-wide
        const product = await prisma.product.findFirst({
          where: {
            id: productId,
            ...branchProductWhere(user.tenantId, user.currentBranchId),
          },
          select: { id: true }
        });
        if (!product) {
          // Product doesn't belong to this branch, return empty
          return NextResponse.json({
            transactions: [],
            pagination: { page, limit, totalCount: 0, totalPages: 0 }
          });
        }
      } else if (user?.currentBranchId) {
        // Filter by products in the current branch (plus tenant-wide stock)
        const branchProducts = await prisma.product.findMany({
          where: branchProductWhere(user.tenantId, user.currentBranchId),
          select: { id: true }
        });
        const productIds = branchProducts.map(p => p.id);
        if (productIds.length > 0) {
          whereClause.entityId = { in: productIds };
        } else {
          // No products in this branch, return empty
          return NextResponse.json({
            transactions: [],
            pagination: { page, limit, totalCount: 0, totalPages: 0 }
          });
        }
      }
      
      if (productId) {
        whereClause.entityId = productId;
      }
      
      const totalCount = await prisma.auditLog.count({ where: whereClause });
      
      const auditLogs = await prisma.auditLog.findMany({
        where: whereClause,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
      
      // Get product names for the transactions (if not filtering by productId)
      // Also filter products by branch if branch is selected
      let productMap = new Map();
      if (!productId) {
        const productIds = [...new Set(auditLogs.map(log => log.entityId))];
        if (productIds.length > 0) {
          const productWhere = {
            id: { in: productIds },
            tenantId: user.tenantId
          };
          // Add branch filter if branch is selected (include tenant-wide products)
          if (user?.currentBranchId) {
            productWhere.OR = [{ branchId: user.currentBranchId }, { branchId: null }];
          }
          const products = await prisma.product.findMany({
            where: productWhere,
            select: {
              id: true,
              name: true
            }
          });
          productMap = new Map(products.map(p => [p.id, p.name]));
        }
      } else {
        // If filtering by productId, fetch that product's name
        const productWhere = {
          id: productId,
          tenantId: user.tenantId
        };
        // Add branch filter if branch is selected (include tenant-wide products)
        if (user?.currentBranchId) {
          productWhere.OR = [{ branchId: user.currentBranchId }, { branchId: null }];
        }
        const product = await prisma.product.findFirst({
          where: productWhere,
          select: { id: true, name: true }
        });
        if (product) {
          productMap.set(product.id, product.name);
        }
      }
      
      // Filter transactions to only include those with products in the current branch
      const formattedTransactions = auditLogs
        .filter(log => {
          // Only include transactions for products that exist in productMap
          // (productMap is already filtered by branch)
          return productMap.has(log.entityId);
        })
        .map(log => {
          const details = JSON.parse(log.details || '{}');
          const actionType = log.action;
          let type = 'Adjustment';
          if (actionType.includes('STOCK_IN')) type = 'Stock In';
          else if (actionType.includes('STOCK_OUT')) type = 'Stock Out';
          
          return {
            id: log.id,
            type: type,
            quantity: details.quantity || 0,
            date: log.timestamp ? new Date(log.timestamp).toISOString() : new Date().toISOString(),
            product: productMap.get(log.entityId) || 'Unknown Product',
            productId: log.entityId,
            user: log.user?.name || 'Unknown User',
            userId: log.user?.id,
            notes: details.notes || null
          };
        });
      
      return NextResponse.json({
        transactions: formattedTransactions,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      });
    }
    
    // If the model exists, use InventoryTransaction table
    const whereClause = { tenantId: user.tenantId };
    if (productId) {
      whereClause.productId = productId;
    }
    
    // Add branch filtering for InventoryTransaction (include tenant-wide products)
    if (user?.currentBranchId) {
      const branchProducts = await prisma.product.findMany({
        where: branchProductWhere(user.tenantId, user.currentBranchId),
        select: { id: true }
      });
      const productIds = branchProducts.map(p => p.id);
      if (productIds.length > 0) {
        if (productId) {
          // If filtering by specific product, check if it's in branch
          if (!productIds.includes(productId)) {
            return NextResponse.json({
              transactions: [],
              pagination: { page, limit, totalCount: 0, totalPages: 0 }
            });
          }
        } else {
          // Filter transactions by products in branch
          whereClause.productId = { in: productIds };
        }
      } else {
        // No products in this branch, return empty
        return NextResponse.json({
          transactions: [],
          pagination: { page, limit, totalCount: 0, totalPages: 0 }
        });
      }
    }
    
    const totalCount = await prisma.inventoryTransaction.count({ where: whereClause });
    
    const transactions = await prisma.inventoryTransaction.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true
          }
        },
        user: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    
    const formattedTransactions = transactions.map(tx => ({
      id: tx.id,
      type: tx.type,
      quantity: tx.quantity,
      date: tx.createdAt.toISOString(),
      product: tx.product?.name || 'Unknown Product',
      productId: tx.product?.id,
      user: tx.user?.name || 'Unknown User',
      userId: tx.user?.id,
      notes: tx.notes || null
    }));
    
    return NextResponse.json({
      transactions: formattedTransactions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching inventory transactions:', error);
    // Fallback to empty data on any error
    return NextResponse.json({
      transactions: [],
      pagination: {
        page: 1,
        limit: 10,
        totalCount: 0,
        totalPages: 0
      },
      error: "Unable to fetch inventory transactions. The feature may not be fully set up yet."
    });
  }
}

// POST - Handle inventory movements without the Transaction model
export async function POST(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    // Ensure numeric quantity to avoid string concatenation bugs (e.g., 12 + "12" => "1212")
    const quantity = Number(body.quantity);
    const unitCost = body.unitCost ? Number(body.unitCost) : null;
    
    // Validate required fields
    if (!body.productId || !body.type || Number.isNaN(quantity)) {
      return NextResponse.json(
        { error: 'Product ID, transaction type, and a valid numeric quantity are required' },
        { status: 400 }
      );
    }
    
    // Check for duplicate request (prevents double processing)
    const requestKey = getRequestKey(user.id, body.productId, body.type, quantity, unitCost);
    if (isDuplicateRequest(requestKey)) {
      console.warn(`[Stock Transaction] ⚠️ DUPLICATE REQUEST DETECTED: ${requestKey}. Returning cached response.`);
      return NextResponse.json(
        { error: 'Duplicate request detected. Please wait a moment and try again.' },
        { status: 429 } // Too Many Requests
      );
    }
    
    // Check if product exists and belongs to the tenant
    const product = await prisma.product.findFirst({
      where: {
        id: body.productId,
        tenantId: user.tenantId
      },
      select: {
        id: true,
        stockLevel: true,
        cost: true,
        branchId: true,
        tenantId: true,
        isService: true
      }
    });
    
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found or access denied' },
        { status: 404 }
      );
    }
    
    // Calculate new stock level based on transaction type
    let newStockLevel = Number(product.stockLevel) || 0;
    let stockChange = 0;
    
    if (body.type === 'Stock In') {
      stockChange = quantity;
      newStockLevel += quantity;
    } else if (body.type === 'Stock Out') {
      if (quantity > newStockLevel) {
        return NextResponse.json(
          { error: `Cannot remove more than available stock (${newStockLevel})` },
          { status: 400 }
        );
      }
      stockChange = -quantity;
      newStockLevel -= quantity;
    } else if (body.type === 'Adjustment') {
      // For adjustment, the quantity is the absolute value to adjust to
      stockChange = quantity - newStockLevel;
      newStockLevel = Math.max(0, quantity);
    }
    
    // Ensure stock level doesn't go negative
    newStockLevel = Math.max(0, newStockLevel);
    
    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      let updatedProduct;
      let lossJournalEntryId = null;
      
      // For Stock In transactions, createFifoBatch will update stockLevel
      // For other transaction types, update stockLevel directly
      if (body.type === 'Stock In' && stockChange > 0) {
        // Get current stock level within transaction to detect if it was already updated
        const productInTx = await tx.product.findUnique({
          where: { id: body.productId },
          select: { id: true, stockLevel: true }
        });
        
        console.log(`[Stock Transaction] Stock In: Product ${product.id}, Current stock: ${productInTx.stockLevel}, Adding: ${stockChange}, Expected: ${Number(productInTx.stockLevel) + stockChange}`);
        
        // Use provided unit cost or product's current cost (default to 0 if not provided)
        // IMPORTANT: If user doesn't provide unitCost, we use product.cost as fallback
        // But this should be explicitly provided by the user for accurate FIFO tracking
        const unitCost = body.unitCost ? Number(body.unitCost) : (Number(product.cost) || 0);
        
        console.log(`[Stock Transaction] Stock In: qty=${stockChange}, provided unitCost=${body.unitCost}, using unitCost=${unitCost}, product.cost=${product.cost}`);
        
        // ALWAYS create FIFO batch for Stock In, even if cost is 0
        // This ensures FIFO tracking works for all stock additions
        try {
          // Generate a deterministic transaction ID based on request parameters
          // This ensures duplicate requests (even from different API calls) get the same sourceId
          // Format: stockin-{userId}-{productId}-{quantity}-{unitCost}-{roundedTimestamp}
          // Round timestamp to nearest 30 seconds to catch duplicates within a longer window
          const roundedTimestamp = Math.floor(Date.now() / 30000) * 30000; // Round to nearest 30 seconds
          const deterministicSourceId = `stockin-${user.id}-${product.id}-${stockChange}-${unitCost}-${roundedTimestamp}`;
          
          console.log(`[Stock Transaction] Creating FIFO batch with sourceId: ${deterministicSourceId} (rounded timestamp: ${roundedTimestamp}), cost: ${unitCost}`);
          
          const { createFifoBatch } = await import('@/lib/fifoCosting');
          const fifoResult = await createFifoBatch({
            tenantId: user.tenantId,
            branchId: product.branchId || null,
            productId: product.id,
            quantityPurchased: stockChange,
            unitCost: unitCost, // Can be 0, FIFO will still track the batch
            purchaseDate: new Date(),
            sourceType: 'StockIn',
            sourceId: deterministicSourceId, // Deterministic ID ensures idempotency
            expiryDate: body.expiryDate || null,
            tx: tx,
          });
          console.log(`[Stock Transaction] Created FIFO batch for Stock In: ${stockChange} units at ${unitCost} each`);
          
          // Verify stock was updated correctly
          updatedProduct = await tx.product.findUnique({
            where: { id: body.productId },
            select: { id: true, stockLevel: true, updatedAt: true }
          });
          const expectedStock = Number(productInTx.stockLevel) + stockChange;
          const actualStock = Number(updatedProduct.stockLevel);
          console.log(`[Stock Transaction] After FIFO batch: Product ${product.id}, Expected stock: ${expectedStock}, Actual stock: ${actualStock}`);
          
          if (actualStock !== expectedStock) {
            console.error(`[Stock Transaction] ⚠️ STOCK MISMATCH! Expected ${expectedStock}, got ${actualStock}. Difference: ${actualStock - expectedStock}`);
          }
        } catch (fifoError) {
          console.error('Error creating FIFO batch for Stock In:', fifoError);
          // If FIFO fails, still update stock manually as fallback
          updatedProduct = await tx.product.update({
            where: { id: body.productId },
            data: { stockLevel: newStockLevel }
          });
        }
      } else if (product.isService) {
        updatedProduct = await tx.product.findUnique({
          where: { id: body.productId },
          select: { id: true, stockLevel: true, updatedAt: true },
        });
      } else {
        let fifoCogsAmount = 0;
        if (stockChange < 0) {
          const decreaseQty = Math.abs(stockChange);
          try {
            const { consumeFifoForSale } = await import('@/lib/fifoCosting');
            const fifo = await consumeFifoForSale({
              tenantId: user.tenantId,
              branchId: product.branchId || null,
              productId: product.id,
              quantitySold: decreaseQty,
              tx,
              updateSoldQty: false,
            });
            fifoCogsAmount = Number(fifo?.cogsAmount) || 0;
          } catch (fifoErr) {
            console.warn('[Stock Transaction] FIFO consume skipped:', fifoErr?.message || fifoErr);
          }
        } else if (stockChange > 0 && body.type === 'Adjustment') {
          const adjUnitCost = body.unitCost ? Number(body.unitCost) : (Number(product.cost) || 0);
          try {
            const { createFifoBatch } = await import('@/lib/fifoCosting');
            await createFifoBatch({
              tenantId: user.tenantId,
              branchId: product.branchId || null,
              productId: product.id,
              quantityPurchased: stockChange,
              unitCost: adjUnitCost,
              purchaseDate: new Date(),
              sourceType: 'StockAdjustment',
              sourceId: `adj-in-${user.id}-${product.id}-${stockChange}-${Date.now()}`,
              tx,
            });
          } catch (fifoErr) {
            console.warn('[Stock Transaction] FIFO batch for positive adjustment skipped:', fifoErr?.message || fifoErr);
          }
        }

        updatedProduct = await tx.product.update({
          where: { id: body.productId },
          data: { stockLevel: newStockLevel }
        });

        try {
          const { recomputeProductStockValue } = await import('@/lib/inventoryWriteOffService');
          await recomputeProductStockValue(tx, user.tenantId, product.id);
          updatedProduct = await tx.product.findUnique({
            where: { id: body.productId },
            select: { id: true, stockLevel: true, updatedAt: true },
          });
        } catch (valErr) {
          console.warn('[Stock Transaction] totalStockValue recompute skipped:', valErr?.message || valErr);
        }

        if (stockChange < 0) {
          const decreaseQty = Math.abs(stockChange);
          const basisUnitCost = Number.isFinite(unitCost) && unitCost >= 0 ? unitCost : (Number(product.cost) || 0);
          const lossAmount = fifoCogsAmount > 0
            ? Math.round(fifoCogsAmount * 100) / 100
            : Math.round(decreaseQty * Math.max(0, basisUnitCost) * 100) / 100;
          if (lossAmount > 0) {
            const sourceId = `manual-stockout-${user.id}-${body.productId}-${body.type}-${decreaseQty}-${lossAmount}`;
            try {
              const journal = await createInventoryWriteOffJournalEntry({
                tenantId: user.tenantId,
                userId: user.id,
                amount: lossAmount,
                description: `Manual ${body.type} inventory loss`,
                sourceType: 'InventoryManualStockOut',
                sourceId,
                sourceBatchId: null,
                tx,
              });
              lossJournalEntryId = journal?.id || journal?.journalEntryId || null;
              const lossAccountId =
                journal?.lines?.find((line) => Number(line.debitAmount || 0) > 0)?.accountId || null;
              const expenseReference = `inventory-stockout:${sourceId}`;
              const existingExpense = await tx.expense.findFirst({
                where: {
                  tenantId: user.tenantId,
                  originalReference: expenseReference,
                  isDeleted: false,
                },
                select: { id: true },
              });
              if (!existingExpense) {
                await tx.expense.create({
                  data: {
                    tenantId: user.tenantId,
                    submittedById: user.id,
                    branchId: product.branchId || null,
                    description: `Manual ${body.type} inventory loss`,
                    amount: lossAmount,
                    date: new Date(),
                    category: 'Inventory Adjustment Loss',
                    expenseAccountId: lossAccountId,
                    status: 'Approved',
                    paymentStatus: 'Fully paid',
                    paymentMethod: 'journal',
                    paidAmount: lossAmount,
                    originalReference: expenseReference,
                    notes: body.notes || null,
                  },
                });
              }
            } catch (journalErr) {
              console.error('[Stock Transaction] GL posting failed; stock quantity still updated:', journalErr);
            }
          }
        }
      }

      const movementQuantity = body.type === 'Stock In' ? quantity : body.type === 'Stock Out' ? -quantity : stockChange;
      const movementNotes = body.notes || (body.type === 'Adjustment' ? `Adjusted to ${quantity} units (was ${product.stockLevel || 0})` : null);
      let movementId = null;
      try {
        const movement = await tx.inventoryTransaction.create({
          data: {
            type: body.type,
            quantity: movementQuantity,
            notes: movementNotes,
            productId: body.productId,
            userId: user.id,
            tenantId: user.tenantId,
            branchId: product.branchId || null
          }
        });
        movementId = movement.id;
      } catch (invErr) {
        console.warn('InventoryTransaction create failed inside stock tx:', invErr?.message || invErr);
      }
      
      return { updatedProduct, lossJournalEntryId, movementId };
    });
    
    const updatedProduct = result.updatedProduct;
    
    // Get product name for audit log
    const productWithName = await prisma.product.findUnique({
      where: { id: body.productId },
      select: { name: true, sku: true }
    });
    
    const auditDetails = {
      productId: body.productId,
      productName: productWithName?.name || 'Unknown',
      type: body.type,
      quantity: body.quantity,
      notes: body.notes || null,
      oldStockLevel: product.stockLevel || 0,
      newStockLevel: updatedProduct.stockLevel,
      journalEntryId: result.lossJournalEntryId || null,
    };

    if (body.type === 'Adjustment' || body.type === 'Stock Out') {
      await prisma.auditLog.create({
        data: {
          action: 'STOCK_TRANSACTION_CREATED',
          entityType: 'STOCK',
          entityId: body.productId,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify(auditDetails),
        },
      });
    } else {
      await prisma.auditLog.create({
        data: {
          action: `INVENTORY_${body.type.replace(/\s+/g, '_').toUpperCase()}`,
          entityType: 'PRODUCT',
          entityId: body.productId,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify(auditDetails),
        },
      });
    }

    if (body.type === 'Stock In' && quantity > 0) {
      const unitCost = body.unitCost ? Number(body.unitCost) : (Number(product.cost) || 0);
      const openingStockValue = roundMoney(quantity * unitCost);
      if (openingStockValue > 0) {
        try {
          await postOpeningBalance({
            tenantId: user.tenantId,
            type: 'opening_stock',
            amount: openingStockValue,
            asOfDate: new Date(),
            entityId: body.productId,
            description: `Opening stock — Stock In (${productWithName?.name || product.id})`,
            metadata: { productId: body.productId, quantity, unitCost, source: 'stock_in' },
            createdBy: user.id,
          });
        } catch (obErr) {
          console.warn('[Stock Transaction] Opening stock GL posting skipped or existing:', obErr.message);
        }
      }
      await completeOpeningStockWizardStep(user.tenantId, prisma);
    }
    
    // Determine product status
    let status;
    if (product.isService) {
      status = 'Service';
    } else if (updatedProduct.stockLevel === 0) {
      status = 'Out of Stock';
    } else if (updatedProduct.stockLevel <= 10) { // Default reorderPoint
      status = 'Low Stock';
    } else {
      status = 'In Stock';
    }
    
    // Return a mock transaction result
    return NextResponse.json({
      message: 'Stock update recorded successfully',
      transaction: {
        id: result.movementId || 'temp-' + Date.now(),
        type: body.type,
        quantity: body.quantity,
        notes: body.notes || null,
        date: new Date().toISOString(),
        product: productWithName?.name || 'Unknown',
        productId: body.productId,
        user: user.name || 'Unknown User',
        userId: user.id,
        journalEntryId: result.lossJournalEntryId || null,
      },
      updatedProduct: {
        id: updatedProduct.id,
        name: productWithName?.name || 'Unknown',
        sku: productWithName?.sku || null,
        quantityInStock: updatedProduct.stockLevel,
        status: status,
        lastUpdated: updatedProduct.updatedAt.toISOString()
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error recording inventory transaction:', error);
    if (error instanceof AccountingV2Error) {
      return NextResponse.json(
        {
          error: error.userMessage || error.message,
          code: error.code,
        },
        { status: error.httpStatus || 500 }
      );
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to record transaction. Please try again.' },
      { status: 500 }
    );
  }
}