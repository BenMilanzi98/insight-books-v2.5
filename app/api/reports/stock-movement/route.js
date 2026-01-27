// app/api/reports/stock-movement/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const productId = searchParams.get('productId');
    
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    // Get tenant name and logo
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { name: true, logoUrl: true }
    });
    
    // Build where clause
    const where = {
      tenantId: user.tenantId,
      createdAt: { gte: start, lte: end }
    };
    
    if (productId) {
      where.productId = productId;
    }
    
    // Add branch filter if user has a current branch
    if (user.currentBranchId) {
      where.branchId = user.currentBranchId;
    }
    
    // Get inventory transactions
    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            cost: true
          }
        },
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
    
    // Get product(s) for the report
    let products = [];
    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId, tenantId: user.tenantId },
        select: {
          id: true,
          name: true,
          sku: true,
          cost: true,
          stockLevel: true
        }
      });
      if (product) products.push(product);
    } else {
      // Get all products that have transactions in this period
      const productIds = [...new Set(transactions.map(t => t.productId))];
      products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          tenantId: user.tenantId,
          ...(user.currentBranchId ? { branchId: user.currentBranchId } : {})
        },
        select: {
          id: true,
          name: true,
          sku: true,
          cost: true,
          stockLevel: true
        }
      });
    }
    
    // Helper function to determine if transaction is inflow or outflow
    const isInflow = (type, quantity) => {
      const normalizedType = (type || '').toLowerCase();
      // Inflows: positive quantity for purchases, goods receipts, stock in
      if (normalizedType === 'goods_receipt' || normalizedType === 'purchase' || normalizedType === 'stock in') {
        return quantity > 0;
      }
      // Outflows: negative quantity for sales, stock out
      if (normalizedType === 'sale' || normalizedType === 'stock out') {
        return false; // Always outflow
      }
      // For adjustments, check quantity sign
      if (normalizedType === 'adjustment') {
        return quantity > 0;
      }
      // Default: check quantity sign
      return quantity > 0;
    };

    // Helper function to get transaction display type
    const getDisplayType = (type) => {
      const normalizedType = (type || '').toLowerCase();
      const typeMap = {
        'goods_receipt': 'Goods Receipt',
        'purchase': 'Purchase',
        'stock in': 'Stock In',
        'sale': 'Sale',
        'stock out': 'Stock Out',
        'adjustment': 'Adjustment'
      };
      return typeMap[normalizedType] || type || 'Unknown';
    };

    // Process transactions by product
    const productMovements = await Promise.all(products.map(async (product) => {
      const productTransactions = transactions.filter(t => t.productId === product.id);
      
      // Get opening balance: Use actual product stockLevel minus transactions during period
      // This is more accurate than calculating from all historical transactions
      const currentStockLevel = parseFloat(product.stockLevel || 0);
      const productCost = parseFloat(product.cost || 0);
      
      // Calculate opening stock value from FIFO batches (if available)
      const openingBatches = await prisma.inventoryBatch.findMany({
        where: {
          tenantId: user.tenantId,
          productId: product.id,
          purchaseDate: { lt: start },
          ...(user.currentBranchId ? { branchId: user.currentBranchId } : {})
        },
        select: {
          qtyRemaining: true,
          unitCost: true
        }
      });
      
      // Calculate opening balance value
      let openingBalanceValue = 0;
      openingBatches.forEach(batch => {
        const qty = parseFloat(batch.qtyRemaining || 0);
        const cost = parseFloat(batch.unitCost || 0);
        openingBalanceValue += qty * cost;
      });
      
      // If no batches, use product cost * opening quantity
      if (openingBatches.length === 0) {
        // Calculate opening quantity
        let periodNetMovement = 0;
        productTransactions.forEach(transaction => {
          const quantity = transaction.quantity || 0;
          periodNetMovement += quantity;
        });
        const openingBalance = Math.max(0, currentStockLevel - periodNetMovement);
        openingBalanceValue = openingBalance * productCost;
      }
      
      // Calculate net movement during the period
      let periodNetMovement = 0;
      productTransactions.forEach(transaction => {
        const quantity = transaction.quantity || 0;
        periodNetMovement += quantity; // Sales have negative quantity, purchases have positive
      });
      
      // Opening balance = Current stock - net movement during period
      const openingBalance = Math.max(0, currentStockLevel - periodNetMovement);
      
      // Process movements with running balance and costs (sequentially to maintain order)
      let runningBalance = openingBalance;
      let runningValue = openingBalanceValue;
      const movements = [];
      
      for (const transaction of productTransactions) {
        const quantity = transaction.quantity || 0;
        const absQuantity = Math.abs(quantity);
        const isIn = isInflow(transaction.type, quantity);
        
        // Get unit cost for this transaction
        let unitCost = productCost; // Default to product cost
        let totalCost = 0;
        
        if (isIn && quantity > 0) {
          // For inflows, try to get cost from FIFO batches or goods receipt items
          // Check if there's a FIFO batch for this transaction date
          const batch = await prisma.inventoryBatch.findFirst({
            where: {
              tenantId: user.tenantId,
              productId: product.id,
              purchaseDate: { 
                gte: new Date(transaction.createdAt.getTime() - 60000), // 1 minute before
                lte: new Date(transaction.createdAt.getTime() + 60000)  // 1 minute after
              },
              ...(user.currentBranchId ? { branchId: user.currentBranchId } : {})
            },
            orderBy: { createdAt: 'desc' },
            select: { unitCost: true }
          });
          
          if (batch) {
            unitCost = parseFloat(batch.unitCost || 0);
          } else {
            // Try to extract cost from goods receipt if available
            const notes = transaction.notes || '';
            const receiptMatch = notes.match(/Receipt\s+([A-Z0-9-]+)/i);
            if (receiptMatch) {
              const receiptNumber = receiptMatch[1];
              const goodsReceipt = await prisma.goodsReceipt.findFirst({
                where: {
                  tenantId: user.tenantId,
                  receiptNumber: receiptNumber
                },
                include: {
                  items: {
                    where: { productId: product.id },
                    select: { unitCost: true }
                  }
                }
              });
              if (goodsReceipt?.items?.[0]) {
                unitCost = parseFloat(goodsReceipt.items[0].unitCost || 0);
              }
            }
          }
          totalCost = absQuantity * unitCost;
          runningValue += totalCost;
        } else if (!isIn && quantity < 0) {
          // For outflows (sales), calculate COGS using FIFO
          // Get FIFO batch consumptions for this period
          const consumptions = await prisma.inventoryBatchConsumption.findMany({
            where: {
              tenantId: user.tenantId,
              batch: {
                productId: product.id,
                ...(user.currentBranchId ? { branchId: user.currentBranchId } : {})
              },
              createdAt: {
                gte: new Date(transaction.createdAt.getTime() - 60000),
                lte: new Date(transaction.createdAt.getTime() + 60000)
              }
            },
            include: {
              batch: {
                select: { unitCost: true }
              }
            },
            orderBy: { createdAt: 'desc' }
          });
          
          if (consumptions.length > 0) {
            // Calculate average cost from consumptions
            let totalCogs = 0;
            let totalQty = 0;
            consumptions.forEach(cons => {
              const qty = parseFloat(cons.quantity || 0);
              const cost = parseFloat(cons.batch.unitCost || 0);
              totalCogs += qty * cost;
              totalQty += qty;
            });
            if (totalQty > 0) {
              unitCost = totalCogs / totalQty;
              totalCost = absQuantity * unitCost;
            } else {
              totalCost = absQuantity * productCost;
            }
          } else {
            // Use product cost as fallback
            totalCost = absQuantity * productCost;
          }
          runningValue -= totalCost;
        } else if (transaction.type === 'Adjustment') {
          // For adjustments, use product cost
          totalCost = absQuantity * productCost;
          if (quantity > 0) {
            runningValue += totalCost;
          } else {
            runningValue -= totalCost;
          }
        }
        
        // Update running balance
        runningBalance += quantity;
        
        // Determine qty in/out
        let qtyIn = null;
        let qtyOut = null;
        let adjustment = null;
        
        if (transaction.type === 'Adjustment') {
          adjustment = quantity;
        } else if (isIn) {
          qtyIn = absQuantity;
        } else {
          qtyOut = absQuantity;
        }
        
        // Extract reference from notes (could contain invoice/sale/receipt numbers)
        let reference = transaction.notes || 'N/A';
        
        // Try to extract better reference from notes
        if (transaction.notes) {
          // Look for patterns like "Sale INV-001", "Receipt GR-123", etc.
          const match = transaction.notes.match(/(Sale|Invoice|Receipt|Bill|Purchase)\s+([A-Z0-9-]+)/i);
          if (match) {
            reference = match[2];
          }
        }
        
        movements.push({
          date: transaction.createdAt,
          transactionType: getDisplayType(transaction.type),
          qtyIn,
          qtyOut,
          adjustment,
          unitCost: unitCost > 0 ? unitCost : null,
          totalCost: totalCost !== 0 ? totalCost : null,
          balance: runningBalance,
          balanceValue: runningValue,
          reference,
          userId: transaction.userId,
          userName: transaction.user?.name || 'N/A'
        });
      }
      
      // Calculate closing balance value from current FIFO batches
      const closingBatches = await prisma.inventoryBatch.findMany({
        where: {
          tenantId: user.tenantId,
          productId: product.id,
          purchaseDate: { lte: end },
          ...(user.currentBranchId ? { branchId: user.currentBranchId } : {})
        },
        select: {
          qtyRemaining: true,
          unitCost: true
        }
      });
      
      let closingBalanceValue = 0;
      closingBatches.forEach(batch => {
        const qty = parseFloat(batch.qtyRemaining || 0);
        const cost = parseFloat(batch.unitCost || 0);
        closingBalanceValue += qty * cost;
      });
      
      // If no batches, use product cost * closing quantity
      if (closingBatches.length === 0) {
        closingBalanceValue = runningBalance * productCost;
      }
      
      // Calculate totals
      const totalQtyIn = movements.reduce((sum, m) => sum + (m.qtyIn || 0), 0);
      const totalQtyOut = movements.reduce((sum, m) => sum + (m.qtyOut || 0), 0);
      const totalAdjustments = movements.reduce((sum, m) => sum + (m.adjustment || 0), 0);
      const netMovement = totalQtyIn - totalQtyOut + totalAdjustments;
      
      const totalCostIn = movements.reduce((sum, m) => sum + (m.totalCost && m.qtyIn ? m.totalCost : 0), 0);
      const totalCostOut = movements.reduce((sum, m) => sum + (m.totalCost && m.qtyOut ? m.totalCost : 0), 0);
      const totalCostAdjustments = movements.reduce((sum, m) => sum + (m.totalCost && m.adjustment ? m.totalCost : 0), 0);
      const netCostMovement = totalCostIn - totalCostOut + totalCostAdjustments;
      
      return {
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          cost: product.cost
        },
        openingBalance,
        openingBalanceValue,
        movements,
        totals: {
          qtyIn: totalQtyIn,
          qtyOut: totalQtyOut,
          adjustments: totalAdjustments,
          netMovement,
          costIn: totalCostIn,
          costOut: totalCostOut,
          costAdjustments: totalCostAdjustments,
          netCostMovement
        },
        closingBalance: runningBalance,
        closingBalanceValue
      };
    }));
    
    return NextResponse.json({
      companyName: tenant?.name || 'Company',
      logoUrl: tenant?.logoUrl || null,
      period: {
        startDate,
        endDate
      },
      productMovements
    });
  } catch (error) {
    console.error('Error generating stock movement report:', error);
    return NextResponse.json(
      { error: 'Failed to generate stock movement report. Please try again.' },
      { status: 500 }
    );
  }
}

