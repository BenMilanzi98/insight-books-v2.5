import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET /api/tax-types/[id]
 * Get a specific tax type
 */
export async function GET(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;

    const taxType = await prisma.taxType.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
      include: {
        account: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
            accountType: true,
          },
        },
      },
    });

    if (!taxType) {
      return NextResponse.json(
        { error: 'Tax type not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(taxType);
  } catch (error) {
    console.error('Error fetching tax type:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tax type' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/tax-types/[id]
 * Update a tax type
 */
export async function PUT(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const {
      taxId,
      taxName,
      taxCode,
      taxRate,
      calculationType,
      accountId,
      status,
    } = body;

    // Check if tax type exists
    const existingTax = await prisma.taxType.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
    });

    if (!existingTax) {
      return NextResponse.json(
        { error: 'Tax type not found' },
        { status: 404 }
      );
    }

    // If accountId is being updated, validate it
    if (accountId && accountId !== existingTax.accountId) {
      const account = await prisma.account.findFirst({
        where: {
          id: accountId,
          tenantId: user.tenantId,
        },
      });

      if (!account) {
        return NextResponse.json(
          { error: 'Account not found or does not belong to tenant' },
          { status: 400 }
        );
      }

      if (account.accountType !== 'Liability' && account.accountType !== 'Asset') {
        return NextResponse.json(
          { error: 'Tax account must be a Liability or Asset account' },
          { status: 400 }
        );
      }
    }

    // Check for duplicate taxId or taxCode (excluding current record)
    if (taxId || taxCode) {
      const duplicateTax = await prisma.taxType.findFirst({
        where: {
          tenantId: user.tenantId,
          id: { not: id },
          OR: [
            taxId ? { taxId } : {},
            taxCode ? { taxCode } : {},
          ],
        },
      });

      if (duplicateTax) {
        return NextResponse.json(
          { error: 'Tax ID or Tax Code already exists' },
          { status: 400 }
        );
      }
    }

    // Update tax type
    const updateData = {};
    if (taxId !== undefined) updateData.taxId = taxId;
    if (taxName !== undefined) updateData.taxName = taxName;
    if (taxCode !== undefined) updateData.taxCode = taxCode;
    if (taxRate !== undefined) updateData.taxRate = parseFloat(taxRate);
    if (calculationType !== undefined) updateData.calculationType = calculationType;
    if (accountId !== undefined) updateData.accountId = accountId;
    if (status !== undefined) updateData.status = status;

    const taxType = await prisma.taxType.update({
      where: { id },
      data: updateData,
      include: {
        account: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
            accountType: true,
          },
        },
      },
    });

    return NextResponse.json(taxType);
  } catch (error) {
    console.error('Error updating tax type:', error);
    return NextResponse.json(
      { error: 'Failed to update tax type', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tax-types/[id]
 * Delete a tax type
 */
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Check if tax type exists
    const existingTax = await prisma.taxType.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
    });

    if (!existingTax) {
      return NextResponse.json(
        { error: 'Tax type not found' },
        { status: 404 }
      );
    }

    // TODO: Check if tax type is used in any transactions
    // For now, we'll allow deletion but this should be checked in production

    await prisma.taxType.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Tax type deleted successfully' });
  } catch (error) {
    console.error('Error deleting tax type:', error);
    return NextResponse.json(
      { error: 'Failed to delete tax type', details: error.message },
      { status: 500 }
    );
  }
}



