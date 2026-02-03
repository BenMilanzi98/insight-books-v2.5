// app/api/suppliers/[id]/route.js
/**
 * Supplier Individual API Routes
 * Handles GET, PUT, DELETE operations for a specific supplier
 */

import { NextResponse } from 'next/server';
import { 
  getSupplierById, 
  updateSupplier, 
  deleteSupplier,
  validateSupplierData 
} from '@/lib/supplierService';

/**
 * GET /api/suppliers/[id]
 * Get supplier by ID
 */
export async function GET(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const { id } = params;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    const supplier = await getSupplierById(id, tenantId);

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ supplier });
  } catch (error) {
    console.error('Error fetching supplier:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch supplier' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/suppliers/[id]
 * Update a supplier
 */
export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const { tenantId, userId } = body;
    const { id } = params;

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

    const supplier = await updateSupplier(id, tenantId, userId, body);

    return NextResponse.json(
      { 
        message: 'Supplier updated successfully',
        supplier 
      }
    );
  } catch (error) {
    console.error('Error updating supplier:', error);
    
    if (error.message === 'Supplier not found') {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to update supplier' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/suppliers/[id]
 * Delete (soft) a supplier
 */
export async function DELETE(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const { id } = params;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    const result = await deleteSupplier(id, tenantId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error deleting supplier:', error);
    
    if (error.message === 'Supplier not found') {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to delete supplier' },
      { status: 500 }
    );
  }
}
