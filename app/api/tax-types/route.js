import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET /api/tax-types
 * Get all tax types for the current tenant
 */
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // Optional filter: "Active" or "Inactive"

    const where = {
      tenantId: user.tenantId,
    };

    if (status) {
      where.status = status;
    }

    const taxTypes = await prisma.taxType.findMany({
      where,
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
      orderBy: {
        taxName: 'asc',
      },
    });

    return NextResponse.json(taxTypes);
  } catch (error) {
    console.error('Error fetching tax types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tax types' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tax-types
 * Create a new tax type
 */
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      taxId,
      taxName,
      taxCode,
      taxRate,
      calculationType,
      accountId,
      status = 'Active',
    } = body;

    // Validation
    if (!taxId || !taxName || !taxCode || !accountId) {
      return NextResponse.json(
        { error: 'Missing required fields: taxId, taxName, taxCode, accountId' },
        { status: 400 }
      );
    }

    if (taxRate === undefined || taxRate === null) {
      return NextResponse.json(
        { error: 'taxRate is required' },
        { status: 400 }
      );
    }

    // Validate account exists and belongs to tenant
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

    // Validate account type (should be Liability or Asset)
    if (account.accountType !== 'Liability' && account.accountType !== 'Asset') {
      return NextResponse.json(
        { error: 'Tax account must be a Liability or Asset account' },
        { status: 400 }
      );
    }

    // Check for duplicate taxId or taxCode
    const existingTax = await prisma.taxType.findFirst({
      where: {
        tenantId: user.tenantId,
        OR: [
          { taxId },
          { taxCode },
        ],
      },
    });

    if (existingTax) {
      return NextResponse.json(
        { error: 'Tax ID or Tax Code already exists' },
        { status: 400 }
      );
    }

    // Create tax type
    const taxType = await prisma.taxType.create({
      data: {
        taxId,
        taxName,
        taxCode,
        taxRate: parseFloat(taxRate),
        calculationType: calculationType || 'Percentage',
        accountId,
        status,
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

    return NextResponse.json(taxType, { status: 201 });
  } catch (error) {
    console.error('Error creating tax type:', error);
    return NextResponse.json(
      { error: 'Failed to create tax type', details: error.message },
      { status: 500 }
    );
  }
}



