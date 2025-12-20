// app/api/asset-categories/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

/**
 * GET handler for asset categories
 * Fetches all asset categories for the tenant
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
    const search = searchParams.get('search');
    
    // Build filter object for Prisma
    const where = {
      tenantId
    };
    
    // Add search filter if provided
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Fetch asset categories
    const categories = await prisma.assetCategory.findMany({
      where,
      include: {
        _count: {
          select: {
            assets: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    return NextResponse.json({
      categories
    });
  } catch (error) {
    console.error('Error fetching asset categories:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch asset categories. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * POST handler for creating a new asset category
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
    if (!body.name) {
      return NextResponse.json(
        { error: 'Invalid request. Category name is required.' },
        { status: 400 }
      );
    }
    
    // Check if category name already exists
    const existingCategory = await prisma.assetCategory.findFirst({
      where: {
        name: body.name,
        tenantId: tenantId
      }
    });
    
    if (existingCategory) {
      return NextResponse.json(
        { error: 'Asset category with this name already exists' },
        { status: 400 }
      );
    }
    
    // Create category in database
    const category = await prisma.assetCategory.create({
      data: {
        name: body.name,
        description: body.description,
        tenantId: tenantId
      }
    });
    
    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'ASSET_CATEGORY_CREATED',
        entityType: 'ASSET_CATEGORY',
        entityId: category.id,
        userId: user.id,
        tenantId: tenantId,
        details: JSON.stringify({
          categoryId: category.id,
          name: category.name,
          description: category.description
        })
      }
    });
    
    return NextResponse.json({
      message: 'Asset category created successfully',
      category
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating asset category:', error);
    return NextResponse.json(
      { error: 'Failed to create asset category. Please try again.' },
      { status: 500 }
    );
  }
}


