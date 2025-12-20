// app/api/liabilities/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

function calculateTermMonths(startDate, maturityDate) {
  try {
    if (!startDate || !maturityDate) return null;
    const start = new Date(startDate);
    const end = new Date(maturityDate);
    const years = end.getFullYear() - start.getFullYear();
    const months = end.getMonth() - start.getMonth();
    const totalMonths = years * 12 + months + (end.getDate() >= start.getDate() ? 0 : -1);
    return totalMonths > 0 ? totalMonths : null;
  } catch (err) {
    return null;
  }
}
/**
 * GET handler for individual liability
 * Fetches a single liability by ID with all related data
 */
export async function GET(request, { params }) {
  try {
    // Check for standard access (trial or paid subscription)
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    // Authenticate user and get tenant ID
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Fetch liability with all related data
    const liability = await prisma.liability.findFirst({
      where: {
        id: id,
        tenantId: user.tenantId
      },
      include: {
        category: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        payments: {
          orderBy: {
            paymentDate: 'desc'
          }
        }
      }
    });

    if (!liability) {
      return NextResponse.json(
        { error: 'Liability not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      liability
    });

  } catch (error) {
    console.error('Error fetching liability:', error);
    return NextResponse.json(
      { error: 'Failed to fetch liability', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT handler for updating a liability
 * Updates an existing liability
 */
export async function PUT(request, { params }) {
  try {
    // Check for standard access (trial or paid subscription)
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    // Authenticate user and get tenant ID
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.categoryId || !body.liabilityType || !body.principalAmount || !body.startDate) {
      return NextResponse.json(
        { error: 'Missing required fields: name, categoryId, liabilityType, principalAmount, startDate' },
        { status: 400 }
      );
    }

    // Check if liability exists and belongs to tenant
    const existingLiability = await prisma.liability.findFirst({
      where: {
        id: id,
        tenantId: user.tenantId
      }
    });

    if (!existingLiability) {
      return NextResponse.json(
        { error: 'Liability not found' },
        { status: 404 }
      );
    }

    // Validate category exists
    const category = await prisma.liabilityCategory.findFirst({
      where: {
        id: body.categoryId,
        tenantId: user.tenantId
      }
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Invalid liability category' },
        { status: 400 }
      );
    }

    // Update liability
    const interestType = body.interestType || existingLiability.interestType || 'reducing_balance';
    const oneTimeInterestAmount = body.oneTimeInterestAmount ? parseFloat(body.oneTimeInterestAmount) : (existingLiability.oneTimeInterestAmount || 0);
    const derivedTermMonths = body.termMonths ? parseInt(body.termMonths) : calculateTermMonths(body.startDate, body.maturityDate);

    const updatedLiability = await prisma.liability.update({
      where: { id: id },
      data: {
        name: body.name,
        description: body.description,
        categoryId: body.categoryId,
        liabilityType: body.liabilityType,
        principalAmount: parseFloat(body.principalAmount) || 0,
        interestRate: body.interestRate ? parseFloat(body.interestRate) : 0,
        interestType,
        oneTimeInterestAmount,
        startDate: new Date(body.startDate),
        maturityDate: body.maturityDate ? new Date(body.maturityDate) : null,
        termMonths: derivedTermMonths,
        paymentFrequency: body.paymentFrequency || null,
        status: body.status || 'active',
        lender: body.lender || null,
        accountNumber: body.accountNumber || null,
        notes: body.notes || null
        // Note: currentBalance and totalPaid are updated via payments, not directly
      },
      include: {
        category: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'LIABILITY_UPDATED',
        entityType: 'LIABILITY',
        entityId: updatedLiability.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          liabilityId: updatedLiability.id,
          name: updatedLiability.name
        })
      }
    });

    return NextResponse.json({
      message: 'Liability updated successfully',
      liability: updatedLiability
    });

  } catch (error) {
    console.error('Error updating liability:', error);
    return NextResponse.json(
      { error: 'Failed to update liability', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler for deleting a liability
 * Deletes a liability and its related data
 */
export async function DELETE(request, { params }) {
  try {
    // Check for standard access (trial or paid subscription)
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    // Authenticate user and get tenant ID
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check if liability exists and belongs to tenant
    const existingLiability = await prisma.liability.findFirst({
      where: {
        id: id,
        tenantId: user.tenantId
      }
    });

    if (!existingLiability) {
      return NextResponse.json(
        { error: 'Liability not found' },
        { status: 404 }
      );
    }

    // Delete liability (payments will be deleted due to cascade)
    await prisma.liability.delete({
      where: { id: id }
    });

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'LIABILITY_DELETED',
        entityType: 'LIABILITY',
        entityId: id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          liabilityId: id,
          name: existingLiability.name
        })
      }
    });

    return NextResponse.json({
      message: 'Liability deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting liability:', error);
    return NextResponse.json(
      { error: 'Failed to delete liability', details: error.message },
      { status: 500 }
    );
  }
}


