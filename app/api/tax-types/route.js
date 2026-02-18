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

    // Ensure PAYE tax type exists (for backward compatibility)
    try {
      const existingPAYETaxType = await prisma.taxType.findFirst({
        where: {
          tenantId: user.tenantId,
          OR: [
            { taxId: 'PAYE' },
            { taxName: { contains: 'PAYE', mode: 'insensitive' } }
          ]
        }
      });

      if (!existingPAYETaxType) {
        // Check if PAYE deduction exists
        const payeDeduction = await prisma.deduction.findFirst({
          where: {
            tenantId: user.tenantId,
            name: { contains: 'PAYE', mode: 'insensitive' },
            isStatutory: true
          }
        });

        // Only create PAYE tax type if PAYE deduction exists
        if (payeDeduction) {
          // Find or create PAYE Liability account (MUST be Liability type)
          let payeAccount = await prisma.account.findFirst({
            where: {
              tenantId: user.tenantId,
              OR: [
                { name: { contains: 'PAYE', mode: 'insensitive' } },
                { accountName: { contains: 'PAYE', mode: 'insensitive' } }
              ],
              accountType: 'Liability'
            }
          });

          // If PAYE account doesn't exist, create it
          if (!payeAccount) {
            payeAccount = await prisma.account.create({
              data: {
                code: '2100',
                name: 'PAYE Liability',
                type: 'LIABILITY',
                accountCode: '2100',
                accountName: 'PAYE Liability',
                accountType: 'Liability',
                accountSubtype: 'Tax Payable',
                normalBalance: 'Credit',
                balance: 0,
                tenantId: user.tenantId
              }
            });
          }

          // Create PAYE tax type with account linked (REQUIRED)
          await prisma.taxType.create({
            data: {
              taxId: 'PAYE',
              taxName: 'PAYE (Malawi Income Tax 2025/26)',
              taxCode: 'PAYE-2025-26',
              taxRate: 0, // PAYE is calculated dynamically based on brackets, not a fixed rate
              calculationType: 'Percentage',
              accountId: payeAccount.id, // REQUIRED: Always link to account
              status: 'Active',
              tenantId: user.tenantId
            }
          });
        }
      } else if (existingPAYETaxType && !existingPAYETaxType.accountId) {
        // Fix existing tax type that has no account
        let payeAccount = await prisma.account.findFirst({
          where: {
            tenantId: user.tenantId,
            OR: [
              { name: { contains: 'PAYE', mode: 'insensitive' } },
              { accountName: { contains: 'PAYE', mode: 'insensitive' } }
            ],
            accountType: 'Liability'
          }
        });

        if (!payeAccount) {
          payeAccount = await prisma.account.create({
            data: {
              code: '2100',
              name: 'PAYE Liability',
              type: 'LIABILITY',
              accountCode: '2100',
              accountName: 'PAYE Liability',
              accountType: 'Liability',
              accountSubtype: 'Tax Payable',
              normalBalance: 'Credit',
              balance: 0,
              tenantId: user.tenantId
            }
          });
        }

        // Link account to existing tax type
        await prisma.taxType.update({
          where: { id: existingPAYETaxType.id },
          data: { accountId: payeAccount.id }
        });
      }
    } catch (payeError) {
      // Log error but don't fail the request
      console.error('Error ensuring PAYE tax type exists:', payeError);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // Optional filter: "Active" or "Inactive"

    const where = {
      tenantId: user.tenantId,
    };

    if (status) {
      where.status = status;
    }

    // Fetch tax types without include to avoid Prisma relation mismatches on different clients
    const taxTypes = await prisma.taxType.findMany({
      where,
      orderBy: { taxName: 'asc' },
    });

    // Load accounts separately if any tax types have accountId
    const accountIds = [...new Set(taxTypes.map((t) => t.accountId).filter(Boolean))];
    const accounts = accountIds.length
      ? await prisma.account.findMany({
          where: { id: { in: accountIds } },
          select: { id: true, accountCode: true, accountName: true, accountType: true },
        })
      : [];
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    const taxTypesWithAccount = taxTypes.map((t) => ({
      ...t,
      account: t.accountId ? accountMap.get(t.accountId) ?? null : null,
    }));

    return NextResponse.json(taxTypesWithAccount);
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

    // Validation - taxId, taxName and taxRate are required. taxCode and accountId are optional.
    if (!taxId || !taxName) {
      return NextResponse.json(
        { error: 'Missing required fields: taxId, taxName' },
        { status: 400 }
      );
    }

    if (taxRate === undefined || taxRate === null || taxRate === '') {
      return NextResponse.json(
        { error: 'taxRate is required' },
        { status: 400 }
      );
    }

    const parsedRate = parseFloat(taxRate);
    if (Number.isNaN(parsedRate)) {
      return NextResponse.json(
        { error: 'taxRate must be a valid number' },
        { status: 400 }
      );
    }

    // PAYE tax type REQUIRES an account for accurate tracking
    const isPAYE = taxId === 'PAYE' || taxName.toLowerCase().includes('paye');
    if (isPAYE && !accountId) {
      return NextResponse.json(
        { error: 'PAYE tax type requires a linked tax liability account for accurate tracking and reconciliation. Please select a Liability account.' },
        { status: 400 }
      );
    }

    // If accountId provided, validate it exists and belongs to tenant and is allowed
    let account = null;
    if (accountId) {
      account = await prisma.account.findFirst({
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

      // PAYE MUST be linked to a Liability account
      if (isPAYE && account.accountType !== 'Liability') {
        return NextResponse.json(
          { error: 'PAYE tax type must be linked to a Liability account, not an Asset account.' },
          { status: 400 }
        );
      }
    }

    // Check for duplicate taxId or taxCode (only include taxCode in check if provided)
    const or = [{ taxId }];
    if (taxCode) or.push({ taxCode });

    const existingTax = await prisma.taxType.findFirst({
      where: {
        tenantId: user.tenantId,
        OR: or,
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
        taxCode: taxCode || null,
        taxRate: parsedRate,
        calculationType: calculationType || 'Percentage',
        accountId: accountId || null,
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



