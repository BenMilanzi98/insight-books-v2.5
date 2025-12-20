// app/api/assets/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

/**
 * GET handler for individual asset
 * Fetches a single asset by ID with all related data
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

    const { id } = params;

    // Fetch asset with all related data
    const asset = await prisma.asset.findFirst({
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
        depreciationSchedules: {
          orderBy: {
            periodStart: 'desc'
          },
          take: 10 // Get last 10 depreciation records
        }
      }
    });

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Calculate current values
    const latestDepreciation = asset.depreciationSchedules[0];
    const currentAccumulatedDepreciation = latestDepreciation?.accumulatedDepreciation || asset.accumulatedDepreciation || 0;
    const currentNetBookValue = asset.originalCost - currentAccumulatedDepreciation;

    // Format the response
    const formattedAsset = {
      ...asset,
      currentAccumulatedDepreciation,
      currentNetBookValue,
      depreciationSchedules: asset.depreciationSchedules || []
    };

    return NextResponse.json({
      asset: formattedAsset
    });

  } catch (error) {
    console.error('Error fetching asset:', error);
    return NextResponse.json(
      { error: 'Failed to fetch asset', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT handler for updating an asset
 * Updates an existing asset
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

    const { id } = params;
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.categoryId || !body.purchaseDate || !body.originalCost) {
      return NextResponse.json(
        { error: 'Missing required fields: name, categoryId, purchaseDate, originalCost' },
        { status: 400 }
      );
    }

    // Check if asset exists and belongs to tenant
    const existingAsset = await prisma.asset.findFirst({
      where: {
        id: id,
        tenantId: user.tenantId
      }
    });

    if (!existingAsset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Validate category exists
    const category = await prisma.assetCategory.findFirst({
      where: {
        id: body.categoryId,
        tenantId: user.tenantId
      }
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Invalid asset category' },
        { status: 400 }
      );
    }

    // Update asset
    const updatedAsset = await prisma.asset.update({
      where: { id: id },
      data: {
        name: body.name,
        description: body.description,
        categoryId: body.categoryId,
        purchaseDate: new Date(body.purchaseDate),
        originalCost: parseFloat(body.originalCost) || 0,
        usefulLifeYears: parseInt(body.usefulLifeYears) || 1,
        depreciationMethod: body.depreciationMethod || 'straight_line',
        status: body.status || 'active',
        location: body.location,
        serialNumber: body.serialNumber,
        supplier: body.supplier,
        warrantyExpiry: body.warrantyExpiry ? new Date(body.warrantyExpiry) : null,
        notes: body.notes,
        isExistingAsset: body.isExistingAsset || false,
        accumulatedDepreciation: parseFloat(body.accumulatedDepreciation) || 0
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

    return NextResponse.json({
      message: 'Asset updated successfully',
      asset: updatedAsset
    });

  } catch (error) {
    console.error('Error updating asset:', error);
    return NextResponse.json(
      { error: 'Failed to update asset', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler for deleting an asset
 * Deletes an asset and its related data
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

    const { id } = params;

    // Check if asset exists and belongs to tenant
    const existingAsset = await prisma.asset.findFirst({
      where: {
        id: id,
        tenantId: user.tenantId
      }
    });

    if (!existingAsset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Delete asset (depreciation schedules will be deleted due to cascade)
    await prisma.asset.delete({
      where: { id: id }
    });

    return NextResponse.json({
      message: 'Asset deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting asset:', error);
    return NextResponse.json(
      { error: 'Failed to delete asset', details: error.message },
      { status: 500 }
    );
  }
}