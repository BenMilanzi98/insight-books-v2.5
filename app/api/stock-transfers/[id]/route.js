// app/api/stock-transfers/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { userHasAccessToTenant } from '@/lib/tenantStockAccess';
import { upsertReceiptNoticeForTransfer } from '@/lib/stockTransferReceiptNotices';
import {
  executeStockTransferMovement,
  resolveSourceProductForTransfer,
} from '@/lib/stockTransferService';

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
        fromBranch: { include: { tenant: { select: { id: true, name: true } } } },
        toBranch: { include: { tenant: { select: { id: true, name: true } } } },
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

    const fromTenantId = transfer.fromBranch?.tenant?.id || transfer.tenantId;
    const toTenantId = transfer.toBranch?.tenant?.id || transfer.tenantId;

    if (action === 'approve') {
      const canApprove = await userHasAccessToTenant(user, fromTenantId);
      if (!canApprove) {
        return NextResponse.json(
          { error: 'Only users with access to the sending business can approve this transfer' },
          { status: 403 }
        );
      }
    }
    if (action === 'receive') {
      const canReceive = await userHasAccessToTenant(user, toTenantId);
      if (!canReceive) {
        return NextResponse.json(
          { error: 'Only users with access to the receiving business can receive this transfer' },
          { status: 403 }
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
            approvedBy: { connect: { id: user.id } },
            approvedAt: new Date(),
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
        const sourceProduct = await resolveSourceProductForTransfer(tx, transfer, fromTenantId);
        if (!sourceProduct) {
          throw new Error('Source product not found at the sending business');
        }

        const { destinationProduct } = await executeStockTransferMovement({
          tx,
          transfer,
          sourceProduct,
          fromTenantId,
          toTenantId,
          fromBranchId: transfer.fromBranchId,
          toBranchId: transfer.toBranchId,
          fromBranchName: transfer.fromBranch?.name,
          toBranchName: transfer.toBranch?.name,
          userId: user.id,
          sameTenantTransfer: fromTenantId === toTenantId,
        });

        const updatedTransfer = await tx.stockTransfer.update({
          where: { id: transferId },
          data: {
            status: 'received',
            receivedById: user.id,
            receivedAt: new Date(),
          },
          include: {
            product: { select: { id: true, name: true, sku: true } },
            fromBranch: {
              select: { id: true, name: true, tenant: { select: { id: true, name: true } } },
            },
            toBranch: {
              select: { id: true, name: true, tenant: { select: { id: true, name: true } } },
            },
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'STOCK_TRANSFER_RECEIVED',
            entityType: 'STOCK_TRANSFER',
            entityId: transferId,
            userId: user.id,
            tenantId: toTenantId,
            details: JSON.stringify({
              transferId,
              productName: transfer.product.name,
              fromBranch: transfer.fromBranch.name,
              toBranch: transfer.toBranch.name,
              quantity: transfer.quantity,
              sourceProductId: sourceProduct.id,
              destinationProductId: destinationProduct.id,
            }),
          },
        });

        if (fromTenantId !== toTenantId) {
          try {
            await upsertReceiptNoticeForTransfer({
              tenantId: toTenantId,
              stockTransferId: transferId,
              sourceTenantId: fromTenantId,
              sourceTenantName: transfer.fromBranch?.tenant?.name ?? null,
            });
          } catch (noticeErr) {
            console.warn('[Stock Transfer] Receipt notice failed:', noticeErr?.message);
          }
        }

        return updatedTransfer;
      } else if (action === 'reject') {
        const rejectNote = rejectionReason?.trim() || null;
        const mergedNotes = [transfer.notes, rejectNote ? `Rejected: ${rejectNote}` : null]
          .filter(Boolean)
          .join('\n');
        const updatedTransfer = await tx.stockTransfer.update({
          where: { id: transferId },
          data: {
            status: 'rejected',
            rejectedById: user.id,
            rejectedAt: new Date(),
            rejectionReason: rejectNote,
            ...(mergedNotes ? { notes: mergedNotes } : {}),
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

