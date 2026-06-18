// app/api/liabilities/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { assertAccountInSubtree } from '@/lib/coaGlSubtreeValidation.js';

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
 * GET handler for liabilities
 * Fetches all liabilities with filtering, sorting, and pagination
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
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }
    
    const tenantId = user.tenantId;
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const sortBy = searchParams.get('sortBy') || 'startDate';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const categoryId = searchParams.get('categoryId');
    const status = searchParams.get('status');
    const liabilityType = searchParams.get('liabilityType');
    const search = searchParams.get('search');
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Build filter object for Prisma
    const where = {
      tenantId
    };
    
    // Add category filter if provided
    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId;
    }
    
    // Add status filter if provided
    if (status && status !== 'all') {
      where.status = status;
    }
    
    // Add liability type filter if provided
    if (liabilityType && liabilityType !== 'all') {
      where.liabilityType = liabilityType;
    }
    
    // Add search filter if provided
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { lender: { contains: search, mode: 'insensitive' } },
        { accountNumber: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Get total count
    const totalCount = await prisma.liability.count({
      where
    });
    
    // Fetch liabilities with category information
    const liabilities = await prisma.liability.findMany({
      where,
      include: {
        category: true,
        glAccount: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
          },
        },
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
          },
          take: 5 // Get last 5 payments
        },
        _count: {
          select: {
            payments: true
          }
        }
      },
      orderBy: {
        [sortBy]: sortOrder
      },
      skip,
      take: limit
    });
    
    return NextResponse.json({
      liabilities,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching liabilities:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch liabilities. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * POST handler for creating a new liability
 */
export async function POST(request) {
  try {
    // Authenticate user and get tenant ID
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }
    
    const tenantId = user.tenantId;
    
    // Parse request body
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.liabilityType || !body.principalAmount || !body.startDate) {
      return NextResponse.json(
        { error: 'Invalid request. Missing required fields.' },
        { status: 400 }
      );
    }

    let categoryId = body.categoryId;
    if (!categoryId && body.newCategoryName?.trim()) {
      const categoryName = body.newCategoryName.trim();
      let category = await prisma.liabilityCategory.findFirst({
        where: { tenantId, name: { equals: categoryName, mode: 'insensitive' } },
      });
      if (!category) {
        category = await prisma.liabilityCategory.create({
          data: {
            tenantId,
            name: categoryName,
            description: body.newCategoryDescription?.trim() || null,
          },
        });
      }
      categoryId = category.id;
    }

    if (!categoryId) {
      return NextResponse.json(
        { error: 'Category is required. Select a category or provide a new category name.' },
        { status: 400 }
      );
    }
    
    // Verify category exists
    const category = await prisma.liabilityCategory.findFirst({
      where: {
        id: categoryId,
        tenantId: tenantId
      }
    });
    
    if (!category) {
      return NextResponse.json(
        { error: 'Invalid liability category' },
        { status: 400 }
      );
    }

    if (!body.glAccountId) {
      return NextResponse.json(
        { error: 'Liability GL account (under 2000) is required.' },
        { status: 400 }
      );
    }
    try {
      await assertAccountInSubtree(prisma, tenantId, body.glAccountId, '2000');
    } catch (glErr) {
      return NextResponse.json(
        { error: glErr.message || 'Invalid liability GL account' },
        { status: 400 }
      );
    }
    
    // Calculate initial balance (principal amount minus any initial payment)
    const principalAmount = parseFloat(body.principalAmount) || 0;
    const initialBalance = principalAmount;
    const interestType = body.interestType || 'reducing_balance';
    const oneTimeInterestAmount = body.oneTimeInterestAmount ? parseFloat(body.oneTimeInterestAmount) : 0;
    const derivedTermMonths = body.termMonths ? parseInt(body.termMonths) : calculateTermMonths(body.startDate, body.maturityDate);
    
    // Create liability in database
    const liability = await prisma.liability.create({
      data: {
        name: body.name,
        description: body.description,
        categoryId: categoryId,
        liabilityType: body.liabilityType,
        principalAmount: principalAmount,
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
        notes: body.notes || null,
        currentBalance: initialBalance,
        totalPaid: 0,
        tenantId: tenantId,
        createdById: user.id,
        glAccountId: body.glAccountId,
      },
      include: {
        category: true,
        glAccount: {
          select: { id: true, accountCode: true, accountName: true },
        },
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
        action: 'LIABILITY_CREATED',
        entityType: 'LIABILITY',
        entityId: liability.id,
        userId: user.id,
        tenantId: tenantId,
        details: JSON.stringify({
          liabilityId: liability.id,
          name: liability.name,
          category: category.name,
          liabilityType: liability.liabilityType,
          principalAmount: liability.principalAmount
        })
      }
    });
    
    return NextResponse.json({
      message: 'Liability created successfully',
      liability
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating liability:', error);
    return NextResponse.json(
      { error: 'Failed to create liability. Please try again.' },
      { status: 500 }
    );
  }
}


