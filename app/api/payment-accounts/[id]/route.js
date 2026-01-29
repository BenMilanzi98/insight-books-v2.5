import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// GET - Get a specific payment account
export async function GET(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = params;

    const paymentAccount = await prisma.paymentAccount.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      },
      include: {
        allocations: {
          include: {
            payment: {
              select: {
                id: true,
                amount: true,
                paymentDate: true,
                type: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 10 // Last 10 allocations
        }
      }
    });

    if (!paymentAccount) {
      return NextResponse.json({ error: 'Payment account not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, paymentAccount });
  } catch (error) {
    console.error('Error fetching payment account:', error);
    return NextResponse.json({ error: 'Failed to fetch payment account' }, { status: 500 });
  }
}

// PUT - Update a payment account
export async function PUT(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { name, accountType, reference, isActive } = body;

    // Find the payment account
    const existing = await prisma.paymentAccount.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Payment account not found' }, { status: 404 });
    }

    // System accounts (Cash) cannot be deleted or disabled
    if (existing.isSystem && isActive === false) {
      return NextResponse.json({ 
        error: 'System payment accounts cannot be deactivated' 
      }, { status: 400 });
    }

    // Check if name is being changed and if new name already exists
    if (name && name.trim() !== existing.name) {
      const nameExists = await prisma.paymentAccount.findUnique({
        where: {
          tenantId_name: {
            tenantId: user.tenantId,
            name: name.trim()
          }
        }
      });

      if (nameExists && nameExists.id !== id) {
        return NextResponse.json({ 
          error: 'Payment account with this name already exists' 
        }, { status: 400 });
      }
    }

    // Update payment account
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (accountType !== undefined) updateData.accountType = accountType;
    if (reference !== undefined) updateData.reference = reference?.trim() || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const paymentAccount = await prisma.paymentAccount.update({
      where: { id },
      data: updateData
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_ACCOUNT_UPDATED',
        entityType: 'PAYMENT_ACCOUNT',
        entityId: paymentAccount.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          name: paymentAccount.name,
          accountType: paymentAccount.accountType,
          isActive: paymentAccount.isActive
        })
      }
    });

    return NextResponse.json({ success: true, paymentAccount });
  } catch (error) {
    console.error('Error updating payment account:', error);
    return NextResponse.json({ error: 'Failed to update payment account' }, { status: 500 });
  }
}

// DELETE - Delete a payment account (soft delete by deactivating)
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = params;

    // Find the payment account
    const existing = await prisma.paymentAccount.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      },
      include: {
        allocations: {
          take: 1 // Check if there are any allocations
        }
      }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Payment account not found' }, { status: 404 });
    }

    // System accounts cannot be deleted
    if (existing.isSystem) {
      return NextResponse.json({ 
        error: 'System payment accounts cannot be deleted' 
      }, { status: 400 });
    }

    // Check if account has been used in payments
    if (existing.allocations.length > 0) {
      // Instead of deleting, deactivate it
      const paymentAccount = await prisma.paymentAccount.update({
        where: { id },
        data: { isActive: false }
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          action: 'PAYMENT_ACCOUNT_DEACTIVATED',
          entityType: 'PAYMENT_ACCOUNT',
          entityId: paymentAccount.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            name: paymentAccount.name,
            reason: 'Account has payment history'
          })
        }
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Payment account deactivated (has payment history)',
        paymentAccount 
      });
    }

    // If no allocations, can be deleted
    await prisma.paymentAccount.delete({
      where: { id }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_ACCOUNT_DELETED',
        entityType: 'PAYMENT_ACCOUNT',
        entityId: id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          name: existing.name
        })
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Payment account deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting payment account:', error);
    return NextResponse.json({ error: 'Failed to delete payment account' }, { status: 500 });
  }
}

