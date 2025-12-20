// app/api/deductions/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

/**
 * GET handler for deductions
 * Fetches all deductions for the tenant
 */
export async function GET(request) {
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

    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive');
    const isStatutory = searchParams.get('isStatutory');

    const where = {
      tenantId: user.tenantId
    };

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (isStatutory !== null && isStatutory !== undefined) {
      where.isStatutory = isStatutory === 'true';
    }

    // Fetch deductions
    const deductions = await prisma.deduction.findMany({
      where,
      orderBy: [
        { isStatutory: 'desc' },
        { name: 'asc' }
      ]
    });

    return NextResponse.json({
      deductions: deductions
    });

  } catch (error) {
    console.error('Error fetching deductions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deductions', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST handler for creating deductions
 * Creates a new deduction
 */
export async function POST(request) {
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

    const body = await request.json();

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      );
    }

    // Determine if it's percentage or fixed amount
    const isPercentage = body.type === 'percentage' || body.percentage !== undefined;
    const isFixed = body.type === 'fixed' || body.amount !== undefined;

    if (!isPercentage && !isFixed) {
      return NextResponse.json(
        { error: 'Must specify either percentage or amount' },
        { status: 400 }
      );
    }

    let percentage = null;
    let amount = null;

    if (isPercentage) {
      const value = parseFloat(body.percentage || body.value);
      if (isNaN(value) || value < 0 || value > 100) {
        return NextResponse.json(
          { error: 'Percentage must be between 0 and 100' },
          { status: 400 }
        );
      }
      percentage = value;
    }

    if (isFixed) {
      const value = parseFloat(body.amount || body.value);
      if (isNaN(value) || value < 0) {
        return NextResponse.json(
          { error: 'Amount must be a positive number' },
          { status: 400 }
        );
      }
      amount = value;
    }

    // Create deduction
    const deduction = await prisma.deduction.create({
      data: {
        name: body.name,
        description: body.description || null,
        amount: amount,
        percentage: percentage,
        isStatutory: body.isStatutory || false,
        isActive: body.isActive !== undefined ? body.isActive : true,
        tenantId: user.tenantId
      }
    });

    return NextResponse.json({
      message: 'Deduction created successfully',
      deduction: deduction
    });

  } catch (error) {
    console.error('Error creating deduction:', error);
    return NextResponse.json(
      { error: 'Failed to create deduction', details: error.message },
      { status: 500 }
    );
  }
}


