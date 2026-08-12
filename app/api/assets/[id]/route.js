// app/api/assets/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { assertAccountInSubtree } from '@/lib/coaGlSubtreeValidation.js';

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

    const resolvedParams = typeof params?.then === 'function' ? await params : params;
    const { id } = resolvedParams || {};
    if (!id) {
      return NextResponse.json({ error: 'Invalid asset id' }, { status: 400 });
    }

    // Fetch asset for the current session business
    const asset = await prisma.asset.findFirst({
      where: {
        id: id,
        tenantId: user.tenantId
      },
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
        depreciationSchedules: {
          orderBy: {
            periodStart: 'desc'
          },
          take: 10 // Get last 10 depreciation records
        },
        interBusinessTransfers: {
          orderBy: { transferredAt: 'desc' },
          take: 50,
          include: {
            transferredBy: {
              select: { id: true, name: true, email: true },
            },
          },
        },
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

    const resolvedParams = typeof params?.then === 'function' ? await params : params;
    const { id } = resolvedParams || {};
    if (!id) {
      return NextResponse.json({ error: 'Invalid asset id' }, { status: 400 });
    }
    const body = await request.json();
    const tenantId = user.tenantId;

    let categoryId = body.categoryId;
    if (!categoryId && body.newCategoryName?.trim()) {
      const categoryName = body.newCategoryName.trim();
      let created = await prisma.assetCategory.findFirst({
        where: { tenantId, name: { equals: categoryName, mode: 'insensitive' } },
      });
      if (!created) {
        created = await prisma.assetCategory.create({
          data: {
            tenantId,
            name: categoryName,
            description: body.newCategoryDescription?.trim() || null,
          },
        });
      }
      categoryId = created.id;
    }

    // Validate required fields
    if (!body.name || !categoryId || !body.purchaseDate || !body.originalCost) {
      return NextResponse.json(
        { error: 'Missing required fields: name, category, purchaseDate, originalCost' },
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
        id: categoryId,
        tenantId: user.tenantId
      }
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Invalid asset category' },
        { status: 400 }
      );
    }

    if (!body.glAccountId) {
      return NextResponse.json(
        { error: 'Fixed asset GL account (under 1500) is required.' },
        { status: 400 }
      );
    }
    try {
      await assertAccountInSubtree(prisma, user.tenantId, body.glAccountId, '1500');
    } catch (glErr) {
      return NextResponse.json(
        { error: glErr.message || 'Invalid fixed asset GL account' },
        { status: 400 }
      );
    }

    // Update asset (changing glAccountId does not re-post historical journals)
    const updatedAsset = await prisma.asset.update({
      where: { id: id },
      data: {
        name: body.name,
        description: body.description,
        categoryId,
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
        accumulatedDepreciation: parseFloat(body.accumulatedDepreciation) || 0,
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

    const resolvedParams = typeof params?.then === 'function' ? await params : params;
    const { id } = resolvedParams || {};
    if (!id) {
      return NextResponse.json({ error: 'Invalid asset id' }, { status: 400 });
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