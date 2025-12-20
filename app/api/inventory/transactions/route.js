// app/api/inventory/transactions/route.js - Emergency fix
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

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
      let productMap = new Map();
      if (!productId) {
        const productIds = [...new Set(auditLogs.map(log => log.entityId))];
        if (productIds.length > 0) {
          const products = await prisma.product.findMany({
            where: {
              id: { in: productIds },
              tenantId: user.tenantId
            },
            select: {
              id: true,
              name: true
            }
          });
          productMap = new Map(products.map(p => [p.id, p.name]));
        }
      } else {
        // If filtering by productId, fetch that product's name
        const product = await prisma.product.findUnique({
          where: { id: productId, tenantId: user.tenantId },
          select: { id: true, name: true }
        });
        if (product) {
          productMap.set(product.id, product.name);
        }
      }
      
      const formattedTransactions = auditLogs.map(log => {
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
    
    // Validate required fields
    if (!body.productId || !body.type || Number.isNaN(quantity)) {
      return NextResponse.json(
        { error: 'Product ID, transaction type, and a valid numeric quantity are required' },
        { status: 400 }
      );
    }
    
    // Check if product exists and belongs to the tenant
    const product = await prisma.product.findUnique({
      where: {
        id: body.productId,
        tenantId: user.tenantId
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
    
    if (body.type === 'Stock In') {
      newStockLevel += quantity;
    } else if (body.type === 'Stock Out') {
      if (quantity > newStockLevel) {
        return NextResponse.json(
          { error: `Cannot remove more than available stock (${newStockLevel})` },
          { status: 400 }
        );
      }
      newStockLevel -= quantity;
    } else if (body.type === 'Adjustment') {
      // For adjustment, the quantity is the absolute value to adjust to
      newStockLevel = Math.max(0, quantity);
    }
    
    // Ensure stock level doesn't go negative
    newStockLevel = Math.max(0, newStockLevel);
    
    // Update the product's stock level directly
    const updatedProduct = await prisma.product.update({
      where: { id: body.productId },
      data: { stockLevel: newStockLevel }
    });
    
    // Create an audit log entry instead of a transaction record
    await prisma.auditLog.create({
      data: {
        action: `INVENTORY_${body.type.replace(/\s+/g, '_').toUpperCase()}`,
        entityType: 'PRODUCT',
        entityId: body.productId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          productName: product.name,
          quantity: body.quantity,
          notes: body.notes || null,
          oldStockLevel: product.stockLevel || 0,
          newStockLevel: updatedProduct.stockLevel
        })
      }
    });
    
    // Determine product status
    let status;
    if (updatedProduct.stockLevel === 0) {
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
        id: 'temp-' + Date.now(), // Temporary ID since we don't have a real transaction
        type: body.type,
        quantity: body.quantity,
        notes: body.notes || null,
        date: new Date().toISOString(),
        product: product.name,
        productId: body.productId,
        user: user.name || 'Unknown User',
        userId: user.id
      },
      updatedProduct: {
        id: updatedProduct.id,
        name: product.name,
        sku: product.sku,
        quantityInStock: updatedProduct.stockLevel,
        status: status,
        lastUpdated: updatedProduct.updatedAt.toISOString()
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error recording inventory transaction:', error);
    return NextResponse.json(
      { error: 'Failed to record transaction. Please try again.' },
      { status: 500 }
    );
  }
}