import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { isMalawiSystemTaxType, isTaxGlChildCode, isTaxGlParentCode } from '@/lib/malawiTaxCatalog.js';
import { validateTaxRate } from '@/lib/taxRateValidation.js';

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
    const perm = await requirePermission(request, 'tax.update');
    if (perm) return perm;

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
      effectiveFrom,
      effectiveTo,
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

    const isSystem = isMalawiSystemTaxType(existingTax);
    if (isSystem && taxId !== undefined && taxId !== existingTax.taxId) {
      return NextResponse.json(
        { error: 'Malawi system tax types cannot be renamed (taxId is fixed).' },
        { status: 400 }
      );
    }
    // Check if this is PAYE tax type
    const isPAYE = existingTax.taxId === 'PAYE' || existingTax.taxName?.toLowerCase().includes('paye');
    
    // PAYE tax type REQUIRES an account - cannot remove it
    if (isPAYE && accountId === null) {
      return NextResponse.json(
        { error: 'PAYE tax type requires a linked tax liability account for accurate tracking. Cannot remove the account link.' },
        { status: 400 }
      );
    }

    // If accountId is being updated, validate it (if provided)
    if (accountId !== undefined && accountId !== existingTax.accountId) {
      // PAYE must always have an account
      if (isPAYE && !accountId) {
        return NextResponse.json(
          { error: 'PAYE tax type requires a linked tax liability account. Cannot remove the account link.' },
          { status: 400 }
        );
      }

      if (accountId) {
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

        const acCode = account.accountCode || account.code || '';
        if (isTaxGlParentCode(acCode)) {
          return NextResponse.json(
            { error: 'Post to a child account under 2041 or 2045, not the rollup parent.' },
            { status: 400 }
          );
        }
        if (isSystem && !isTaxGlChildCode(acCode) && !acCode.startsWith('2041-') && !acCode.startsWith('2045-')) {
          return NextResponse.json(
            { error: 'System Malawi tax types must stay linked to their 2041-xx / 2045-xx GL account.' },
            { status: 400 }
          );
        }

        // PAYE MUST be linked to a Liability account
        if (isPAYE && account.accountType !== 'Liability') {
          return NextResponse.json(
            { error: 'PAYE tax type must be linked to a Liability account, not an Asset account.' },
            { status: 400 }
          );
        }
      }
    }

    // Check for duplicate taxId or taxCode (excluding current record)
    const or = [];
    if (taxId) or.push({ taxId });
    if (taxCode) or.push({ taxCode });

    if (or.length > 0) {
      const duplicateTax = await prisma.taxType.findFirst({
        where: {
          tenantId: user.tenantId,
          id: { not: id },
          OR: or,
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
    if (taxCode !== undefined) updateData.taxCode = taxCode || null;
    if (taxRate !== undefined) {
      const calcType =
        calculationType !== undefined ? calculationType : existingTax.calculationType || 'Percentage';
      const rateCheck = validateTaxRate(taxRate, calcType);
      if (!rateCheck.ok) {
        return NextResponse.json({ error: rateCheck.error }, { status: 400 });
      }
      updateData.taxRate = rateCheck.value;
    }
    if (calculationType !== undefined) updateData.calculationType = calculationType;
    if (accountId !== undefined) updateData.accountId = accountId || null;
    if (status !== undefined) updateData.status = status;
    if (effectiveFrom !== undefined) {
      updateData.effectiveFrom = effectiveFrom ? new Date(effectiveFrom) : null;
    }
    if (effectiveTo !== undefined) {
      updateData.effectiveTo = effectiveTo ? new Date(effectiveTo) : null;
    }

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
    const perm = await requirePermission(request, 'tax.update');
    if (perm) return perm;

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

    if (isMalawiSystemTaxType(existingTax)) {
      return NextResponse.json(
        { error: 'Predefined Malawi tax types cannot be deleted. Set status to Inactive instead.' },
        { status: 400 }
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



