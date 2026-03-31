// app/api/stock-transfers/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { createFifoBatch } from '@/lib/fifoCosting';
import { Prisma } from '@prisma/client';

// GET - Fetch stock transfers for the tenant
export async function GET(request) {
  try {
    // Check for standard access
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    // Get user from session
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const branchId = searchParams.get('branchId');

    // Build where clause
    const where = {
      tenantId: user.tenantId
    };

    if (status && status !== 'all') {
      where.status = status;
    }

    if (branchId) {
      where.OR = [
        { fromBranchId: branchId },
        { toBranchId: branchId }
      ];
    }

    // Fetch transfers with related data
    // Handle case where StockTransfer table might not exist yet
    let transfers = [];
    try {
      transfers = await prisma.stockTransfer.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              image: true
            }
          },
          fromBranch: {
            select: {
              id: true,
              name: true
            }
          },
          toBranch: {
            select: {
              id: true,
              name: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          approvedBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          receivedBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          rejectedBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    } catch (dbError) {
      // If table doesn't exist, return empty array
      if (dbError.code === 'P2021' || dbError.message?.includes('does not exist') || dbError.message?.includes('Unknown model')) {
        console.warn('StockTransfer table does not exist yet. Run migration first.');
        transfers = [];
      } else {
        console.error('Database error fetching stock transfers:', dbError);
        console.error('Error code:', dbError.code);
        console.error('Error message:', dbError.message);
        // Return empty array instead of throwing to prevent 500 error
        transfers = [];
      }
    }

    return NextResponse.json({
      transfers,
      count: transfers.length
    });
  } catch (error) {
    console.error('Error fetching stock transfers:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return NextResponse.json(
      { error: 'Failed to fetch stock transfers', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new stock transfer
export async function POST(request) {
  try {
    // Check for standard access
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    // Get user from session
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    console.log('[Stock Transfer] Request body:', JSON.stringify(body, null, 2));
    const { fromBranch, toBranch, productId, quantity, notes } = body;

    // Validate required fields
    if (!fromBranch || !toBranch || !productId || !quantity) {
      console.error('[Stock Transfer] Missing required fields:', { fromBranch, toBranch, productId, quantity });
      return NextResponse.json(
        { error: 'From business, to business, product, and quantity are required' },
        { status: 400 }
      );
    }
    
    console.log('[Stock Transfer] Validating transfer:', {
      fromBranch,
      toBranch,
      productId,
      quantity,
      tenantId: user.tenantId,
      userId: user.id
    });

    // Validate quantity
    const transferQuantity = parseFloat(quantity);
    if (isNaN(transferQuantity) || transferQuantity <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be a positive number' },
        { status: 400 }
      );
    }

    // Validate branches are different
    if (fromBranch === toBranch) {
      return NextResponse.json(
        { error: 'Source and destination businesses must be different' },
        { status: 400 }
      );
    }

    // Validate branches belong to tenant
    const [fromBranchData, toBranchData] = await Promise.all([
      prisma.branch.findFirst({
        where: {
          id: fromBranch,
          tenantId: user.tenantId,
          isActive: true
        }
      }),
      prisma.branch.findFirst({
        where: {
          id: toBranch,
          tenantId: user.tenantId,
          isActive: true
        }
      })
    ]);

    if (!fromBranchData) {
      return NextResponse.json(
        { error: 'Source business not found or inactive' },
        { status: 404 }
      );
    }

    if (!toBranchData) {
      return NextResponse.json(
        { error: 'Destination business not found or inactive' },
        { status: 404 }
      );
    }

    // Source row: at the chosen branch, or org-wide (branchId null = all branches)
    const sourceProduct = await prisma.product.findFirst({
      where: {
        id: productId,
        tenantId: user.tenantId,
        isDeleted: false,
        OR: [{ branchId: fromBranch }, { branchId: null }]
      },
      select: {
        id: true,
        name: true,
        sku: true,
        description: true,
        price: true,
        cost: true,
        category: true,
        location: true,
        reorderPoint: true,
        image: true,
        isService: true,
        stockLevel: true,
        categoryId: true,
        inventoryAccountId: true,
        cogsAccountId: true,
        branchId: true,
        tenantId: true,
        taxRate: true
      }
    });

    if (!sourceProduct) {
      return NextResponse.json(
        { error: 'Product not found at the source business or access denied' },
        { status: 404 }
      );
    }

    // Check if sufficient stock is available
    const availableStock = parseFloat(sourceProduct.stockLevel || 0);
    if (availableStock < transferQuantity) {
      return NextResponse.json(
        { 
          error: `Insufficient stock. Available: ${availableStock}, Requested: ${transferQuantity}` 
        },
        { status: 400 }
      );
    }

    // Check if this should be a direct transfer (auto-complete) or pending
    const { directTransfer = true } = body; // Default to direct transfer for simplicity

    // Create transfer and execute in a transaction
    console.log('[Stock Transfer] Starting transaction...');
    const result = await prisma.$transaction(async (tx) => {
      try {
        // Convert quantity to Decimal for Prisma
        const transferQtyDecimal = new Prisma.Decimal(transferQuantity);
        console.log('[Stock Transfer] Creating transfer record...');
        
        // Create the transfer record
        const transfer = await tx.stockTransfer.create({
        data: {
          tenantId: user.tenantId,
          fromBranchId: fromBranch,
          toBranchId: toBranch,
          productId: productId,
          quantity: transferQtyDecimal,
          status: directTransfer ? 'approved' : 'pending',
          notes: notes || null,
          createdById: user.id,
          ...(directTransfer ? {
            approvedById: user.id,
            approvedAt: new Date()
          } : {})
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true
            }
          },
          fromBranch: {
            select: {
              id: true,
              name: true
            }
          },
          toBranch: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
      
      console.log('[Stock Transfer] Transfer record created:', transfer.id);

      // If direct transfer, execute immediately
      if (directTransfer) {
        console.log('[Stock Transfer] Executing direct transfer...');
        // Get or create destination product
        // Try to find by SKU first, but handle null SKU case
        let destinationProduct = null;
        if (sourceProduct.sku) {
          destinationProduct = await tx.product.findFirst({
            where: {
              tenantId: user.tenantId,
              branchId: toBranch,
              sku: sourceProduct.sku,
              isDeleted: false
            }
          });
        }
        
        // If not found by SKU, try to find by name in the destination branch
        if (!destinationProduct) {
          destinationProduct = await tx.product.findFirst({
            where: {
              tenantId: user.tenantId,
              branchId: toBranch,
              name: sourceProduct.name,
              isDeleted: false
            }
          });
        }

        const productCost = parseFloat(sourceProduct.cost || 0);
        const unitCost = productCost > 0 ? productCost : 0;
        
        // Use the transferQtyDecimal from outer scope
        const qtyDecimal = transferQtyDecimal;

        if (!destinationProduct) {
          // Create product in destination branch
          // Ensure all required fields are present
          console.log('[Stock Transfer] Creating destination product...');
          try {
            const newSku = sourceProduct.sku 
              ? `${sourceProduct.sku}-${toBranch.substring(0, 8)}` 
              : `TRANSFER-${sourceProduct.id.substring(0, 8)}-${Date.now()}`;
            
            destinationProduct = await tx.product.create({
              data: {
                name: sourceProduct.name || 'Transferred Product',
                sku: newSku,
                description: sourceProduct.description || null,
                price: sourceProduct.price ? parseFloat(sourceProduct.price) : 0,
                cost: sourceProduct.cost ? parseFloat(sourceProduct.cost) : null,
                category: sourceProduct.category || null,
                location: sourceProduct.location || null,
                reorderPoint: sourceProduct.reorderPoint || null,
                image: sourceProduct.image || null,
                isService: sourceProduct.isService || false,
                stockLevel: new Prisma.Decimal(0),
                tenantId: user.tenantId,
                branchId: toBranch,
                categoryId: sourceProduct.categoryId || null,
                inventoryAccountId: sourceProduct.inventoryAccountId || null,
                cogsAccountId: sourceProduct.cogsAccountId || null,
                taxRate: sourceProduct.taxRate || 0
              }
            });
            console.log('[Stock Transfer] Destination product created:', destinationProduct.id);
          } catch (createError) {
            console.error('[Stock Transfer] Error creating destination product:', createError);
            console.error('[Stock Transfer] Create error details:', {
              message: createError.message,
              code: createError.code,
              meta: createError.meta
            });
            throw createError;
          }
        } else {
          console.log('[Stock Transfer] Destination product already exists:', destinationProduct.id);
        }

        // Reduce stock from source product
        await tx.product.update({
          where: { id: sourceProduct.id },
          data: {
            stockLevel: {
              decrement: qtyDecimal
            }
          }
        });

        // Add stock to destination product using FIFO
        try {
          // Generate a simple sourceId for the transfer
          const sourceId = `transfer-${transfer.id}`;
          const qtyForFifo = parseFloat(qtyDecimal.toString());
          
          console.log(`[Stock Transfer] Creating FIFO batch:`, {
            productId: destinationProduct.id,
            qty: qtyForFifo,
            cost: unitCost,
            branchId: toBranch,
            tenantId: user.tenantId,
            sourceId: sourceId
          });
          
          await createFifoBatch({
            tenantId: user.tenantId,
            branchId: toBranch,
            productId: destinationProduct.id,
            quantityPurchased: qtyForFifo,
            unitCost: unitCost,
            purchaseDate: new Date(),
            sourceType: 'StockTransfer',
            sourceId: sourceId,
            tx: tx
          });
          console.log(`[Stock Transfer] FIFO batch created successfully`);
        } catch (fifoError) {
          console.error('[Stock Transfer] Error creating FIFO batch:', fifoError);
          console.error('[Stock Transfer] FIFO error details:', {
            message: fifoError.message,
            stack: fifoError.stack,
            code: fifoError.code,
            name: fifoError.name
          });
          // Fallback: update stock directly
          console.log(`[Stock Transfer] Falling back to direct stock update`);
          await tx.product.update({
            where: { id: destinationProduct.id },
            data: {
              stockLevel: {
                increment: qtyDecimal
              }
            }
          });
        }

        // Update transfer status to received
        await tx.stockTransfer.update({
          where: { id: transfer.id },
          data: {
            status: 'received',
            receivedById: user.id,
            receivedAt: new Date()
          }
        });

        // Create inventory transactions
        try {
          // InventoryTransaction.quantity is Int, not Decimal
          const stockOutQty = Math.round(-transferQuantity);
          const stockInQty = Math.round(transferQuantity);
          
          await tx.inventoryTransaction.createMany({
            data: [
              {
                type: 'Stock Out',
                quantity: stockOutQty,
                notes: `Stock transfer to ${toBranchData.name}`,
                productId: sourceProduct.id,
                userId: user.id,
                tenantId: user.tenantId,
                branchId: fromBranch
              },
              {
                type: 'Stock In',
                quantity: stockInQty,
                notes: `Stock transfer from ${fromBranchData.name}`,
                productId: destinationProduct.id,
                userId: user.id,
                tenantId: user.tenantId,
                branchId: toBranch
              }
            ]
          });
        } catch (transactionError) {
          // Log but don't fail the transfer if transaction log fails
          console.warn('Failed to create inventory transactions:', transactionError);
        }
      }

      // Note: Audit log creation moved outside transaction to avoid issues

      // Fetch updated transfer with all relations
      return await tx.stockTransfer.findUnique({
        where: { id: transfer.id },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true
            }
          },
          fromBranch: {
            select: {
              id: true,
              name: true
            }
          },
          toBranch: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
      } catch (txError) {
        console.error('[Stock Transfer] Transaction error:', txError);
        console.error('[Stock Transfer] Transaction error details:', {
          message: txError.message,
          code: txError.code,
          meta: txError.meta,
          stack: txError.stack
        });
        throw txError;
      }
    });
    
    console.log('[Stock Transfer] Transaction completed successfully');

    // Create audit log outside transaction (non-critical, so don't fail if it errors)
    try {
      if (prisma.auditLog && typeof prisma.auditLog.create === 'function') {
        await prisma.auditLog.create({
          data: {
            action: directTransfer ? 'STOCK_TRANSFER_COMPLETED' : 'STOCK_TRANSFER_CREATED',
            entityType: 'STOCK_TRANSFER',
            entityId: result.id,
            userId: user.id,
            tenantId: user.tenantId,
            details: JSON.stringify({
              transferId: result.id,
              productName: sourceProduct.name,
              fromBranch: fromBranchData.name,
              toBranch: toBranchData.name,
              quantity: transferQuantity,
              directTransfer
            })
          }
        });
        console.log('[Stock Transfer] Audit log created successfully');
      }
    } catch (auditError) {
      // Log but don't fail the transfer if audit log fails
      console.warn('[Stock Transfer] Failed to create audit log:', auditError?.message || auditError);
    }

    return NextResponse.json({
      message: 'Stock transfer created successfully',
      transfer: result
    }, { status: 201 });
  } catch (error) {
    console.error('❌ [Stock Transfer] Error creating stock transfer:', error);
    console.error('❌ [Stock Transfer] Error stack:', error.stack);
    console.error('❌ [Stock Transfer] Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      name: error.name,
      cause: error.cause
    });
    
    // Extract more detailed error information
    let errorMessage = error.message || 'Failed to create stock transfer';
    let errorCode = error.code;
    let errorMeta = error.meta;
    
    // Handle Prisma errors specifically
    if (error.code) {
      if (error.code === 'P2002') {
        errorMessage = 'A record with this value already exists';
      } else if (error.code === 'P2003') {
        errorMessage = 'Foreign key constraint failed';
      } else if (error.code === 'P2025') {
        errorMessage = 'Record not found';
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        code: errorCode,
        meta: errorMeta,
        ...(process.env.NODE_ENV === 'development' && {
          details: error.message,
          stack: error.stack?.split('\n').slice(0, 5).join('\n'), // First 5 lines of stack
          name: error.name
        })
      },
      { status: 500 }
    );
  }
}

