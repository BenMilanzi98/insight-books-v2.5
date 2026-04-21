// app/api/suppliers/route.js
/**
 * Supplier API Routes
 * Handles CRUD operations for suppliers
 */

import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { 
  createSupplier, 
  updateSupplier, 
  deleteSupplier, 
  getSuppliers,
  validateSupplierData 
} from '@/lib/supplierService';

/**
 * GET /api/suppliers
 * Get all suppliers with filters and pagination (tenant from session).
 */
export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const tenantId = user.tenantId;
    const { searchParams } = new URL(request.url);

    const options = {
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      isActive: searchParams.get('isActive') === 'true' ? true : 
                searchParams.get('isActive') === 'false' ? false : undefined,
      page: parseInt(searchParams.get('page')) || 1,
      limit: parseInt(searchParams.get('limit')) || 20,
      sortBy: searchParams.get('sortBy') || 'supplierName',
      sortOrder: searchParams.get('sortOrder') || 'asc'
    };

    const result = await getSuppliers(tenantId, options);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch suppliers' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/suppliers
 * Create a new supplier
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { tenantId, userId } = body;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.supplierName) {
      return NextResponse.json(
        { error: 'Supplier name is required' },
        { status: 400 }
      );
    }

    const supplier = await createSupplier(tenantId, userId, body);

    return NextResponse.json(
      { 
        message: 'Supplier created successfully',
        supplier 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating supplier:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create supplier' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/suppliers
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json(
    { message: 'OK' },
    { status: 200 }
  );
}
