// app/api/stock-transfers/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { createFifoBatch } from '@/lib/fifoCosting';

// GET — Transfer detail (source or receiving business)
export async function GET(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: transferId } = await params;

    const transfer = await prisma.stockTransfer.findFirst({
      where: {
        id: transferId,
        OR: [
          { tenantId: user.tenantId },
          { toBranch: { tenantId: user.tenantId } },
        ],
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
            cost: true,
            averageCost: true,
            lastPurchaseCost: true,
          },
        },
        fromBranch: {
          select: {
            id: true,
            name: true,
            tenant: { select: { id: true, name: true } },
          },
        },
        toBranch: {
          select: {
            id: true,
            name: true,
            tenant: { select: { id: true, name: true } },
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!transfer) {
      return NextResponse.json({ error: 'Stock transfer not found' }, { status: 404 });
    }

    return NextResponse.json({ transfer });
  } catch (error) {
    console.error('stock-transfers GET [id]:', error);
    return NextResponse.json({ error: 'Failed to load stock transfer' }, { status: 500 });
  }
}

// PUT - Update stock transfer (approve, receive, reject)
export async function PUT(request, { params }) {
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

    const { id: transferId } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action'); // approve, receive, reject
    const body = await request.json().catch(() => ({}));
    const rejectionReason = body.rejectionReason || null;

    if (!action || !['approve', 'receive', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be approve, receive, or reject' },
        { status: 400 }
      );
    }

    // Fetch transfer with validation (sending or receiving business)
    const transfer = await prisma.stockTransfer.findFirst({
      where: {
        id: transferId,
        OR: [
          { tenantId: user.tenantId },
          { toBranch: { tenantId: user.tenantId } },
        ],
      },
      include: {
        product: true,
        fromBranch: true,
        toBranch: true
      }
    });

    if (!transfer) {
      return NextResponse.json(
        { error: 'Stock transfer not found or access denied' },
        { status: 404 }
      );
    }

    // Validate action based on current status
    if (action === 'approve') {
      if (transfer.status !== 'pending') {
        return NextResponse.json(
          { error: `Cannot approve transfer with status: ${transfer.status}` },
          { status: 400 }
        );
      }
    } else if (action === 'receive') {
      if (transfer.status !== 'approved') {
        return NextResponse.json(
          { error: `Cannot receive transfer with status: ${transfer.status}. Transfer must be approved first.` },
          { status: 400 }
        );
      }
    } else if (action === 'reject') {
      if (transfer.status !== 'pending') {
        return NextResponse.json(
          { error: `Cannot reject transfer with status: ${transfer.status}` },
          { status: 400 }
        );
      }
    }

    // Process the action in a transaction
    const result = await prisma.$transaction(async (tx) => {
      if (action === 'approve') {
        // Update transfer status to approved
        const updatedTransfer = await tx.stockTransfer.update({
          where: { id: transferId },
          data: {
            status: 'approved',
            approvedById: user.id,
            approvedAt: new Date()
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

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: 'STOCK_TRANSFER_APPROVED',
            entityType: 'STOCK_TRANSFER',
            entityId: transferId,
            userId: user.id,
            tenantId: user.tenantId,
            details: JSON.stringify({
              transferId,
              productName: transfer.product.name,
              fromBranch: transfer.fromBranch.name,
              toBranch: transfer.toBranch.name,
              quantity: transfer.quantity
            })
          }
        });

        return updatedTransfer;
      } else if (action === 'receive') {
        // This is where we actually move the stock
        const transferQuantity = parseFloat(transfer.quantity);
        
        // Verify source product still has sufficient stock
        const sourceProduct = await tx.product.findFirst({
          where: {
            id: transfer.productId,
            tenantId: user.tenantId,
            branchId: transfer.fromBranchId,
            isDeleted: false
          }
        });

        if (!sourceProduct) {
          throw new Error('Source product not found in source branch');
        }

        const availableStock = parseFloat(sourceProduct.stockLevel || 0);
        if (availableStock < transferQuantity) {
          throw new Error(`Insufficient stock in source branch. Available: ${availableStock}, Required: ${transferQuantity}`);
        }

        // Get or create destination product
        let destinationProduct = await tx.product.findFirst({
          where: {
            tenantId: user.tenantId,
            branchId: transfer.toBranchId,
            sku: transfer.product.sku,
            isDeleted: false
          }
        });

        const productCost = parseFloat(transfer.product.cost || 0);
        const unitCost = productCost > 0 ? productCost : 0;

        if (!destinationProduct) {
          // Create product in destination branch (copy from source)
          destinationProduct = await tx.product.create({
            data: {
              name: transfer.product.name,
              sku: transfer.product.sku,
              description: transfer.product.description,
              price: transfer.product.price,
              cost: transfer.product.cost,
              category: transfer.product.category,
              location: transfer.product.location,
              reorderPoint: transfer.product.reorderPoint,
              image: transfer.product.image,
              isService: transfer.product.isService || false,
              stockLevel: 0, // Will be updated by FIFO batch
              tenantId: user.tenantId,
              branchId: transfer.toBranchId,
              categoryId: transfer.product.categoryId,
              inventoryAccountId: transfer.product.inventoryAccountId,
              cogsAccountId: transfer.product.cogsAccountId
            }
          });
        }

        // Reduce stock from source product
        await tx.product.update({
          where: { id: sourceProduct.id },
          data: {
            stockLevel: {
              decrement: transferQuantity
            }
          }
        });

        // Add stock to destination product using FIFO
        // This ensures proper cost tracking
        try {
          const sourceId = `stock-transfer-${transferId}-${Date.now()}`;
          await createFifoBatch({
            tenantId: user.tenantId,
            branchId: transfer.toBranchId,
            productId: destinationProduct.id,
            quantityPurchased: transferQuantity,
            unitCost: unitCost,
            purchaseDate: new Date(),
            sourceType: 'StockTransfer',
            sourceId: sourceId,
            tx: tx
          });
        } catch (fifoError) {
          console.error('Error creating FIFO batch for transfer:', fifoError);
          // Fallback: update stock directly if FIFO fails
          await tx.product.update({
            where: { id: destinationProduct.id },
            data: {
              stockLevel: {
                increment: transferQuantity
              }
            }
          });
        }

        // Update transfer status to received
        const updatedTransfer = await tx.stockTransfer.update({
          where: { id: transferId },
          data: {
            status: 'received',
            receivedById: user.id,
            receivedAt: new Date()
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

        // Create inventory transactions for audit trail
        await tx.inventoryTransaction.createMany({
          data: [
            {
              type: 'Stock Out',
              quantity: -transferQuantity,
              notes: `Stock transfer to ${transfer.toBranch.name}`,
              productId: sourceProduct.id,
              userId: user.id,
              tenantId: user.tenantId,
              branchId: transfer.fromBranchId
            },
            {
              type: 'Stock In',
              quantity: transferQuantity,
              notes: `Stock transfer from ${transfer.fromBranch.name}`,
              productId: destinationProduct.id,
              userId: user.id,
              tenantId: user.tenantId,
              branchId: transfer.toBranchId
            }
          ]
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: 'STOCK_TRANSFER_RECEIVED',
            entityType: 'STOCK_TRANSFER',
            entityId: transferId,
            userId: user.id,
            tenantId: user.tenantId,
            details: JSON.stringify({
              transferId,
              productName: transfer.product.name,
              fromBranch: transfer.fromBranch.name,
              toBranch: transfer.toBranch.name,
              quantity: transferQuantity,
              sourceProductId: sourceProduct.id,
              destinationProductId: destinationProduct.id
            })
          }
        });

        return updatedTransfer;
      } else if (action === 'reject') {
        // Update transfer status to rejected
        const updatedTransfer = await tx.stockTransfer.update({
          where: { id: transferId },
          data: {
            status: 'rejected',
            rejectionReason: rejectionReason,
            rejectedById: user.id,
            rejectedAt: new Date()
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

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: 'STOCK_TRANSFER_REJECTED',
            entityType: 'STOCK_TRANSFER',
            entityId: transferId,
            userId: user.id,
            tenantId: user.tenantId,
            details: JSON.stringify({
              transferId,
              productName: transfer.product.name,
              fromBranch: transfer.fromBranch.name,
              toBranch: transfer.toBranch.name,
              quantity: transfer.quantity,
              rejectionReason: rejectionReason
            })
          }
        });

        return updatedTransfer;
      }
    });

    return NextResponse.json({
      message: `Stock transfer ${action}d successfully`,
      transfer: result
    });
  } catch (error) {
    console.error(`Error ${action}ing stock transfer:`, error);
    return NextResponse.json(
      { error: error.message || `Failed to ${action} stock transfer` },
      { status: 500 }
    );
  }
}

