// app/api/purchases/suppliers/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

/**
 * Helper to generate a supplier code
 */
async function generateSupplierCode() {
  // Generate a globally unique SUP-XXXX code to avoid collisions across tenants
  let seq = (await prisma.supplier.count()) + 1;
  let code = `SUP-${String(seq).padStart(4, '0')}`;
  // If a supplier with this code exists (global unique), increment until we find a free code
  while (await prisma.supplier.findUnique({ where: { supplierCode: code } })) {
    seq++;
    code = `SUP-${String(seq).padStart(4, '0')}`;
  }
  return code;
}

/**
 * GET /api/purchases/suppliers
 * Query params:
 *  - search
 *  - status (active/inactive)
 *  - page, limit
 */
export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
    const search = searchParams.get('search')?.trim();
    const status = searchParams.get('status');

    const where = {
      tenantId: user.tenantId
    };

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    if (search) {
      where.OR = [
        { supplierName: { contains: search, mode: 'insensitive' } },
        { supplierCode: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ];
    }

    const totalCount = await prisma.supplier.count({ where });

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    });

    return NextResponse.json({
      suppliers,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suppliers. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/purchases/suppliers
 * Create supplier
 */
export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const supplierName = body.supplierName?.trim();
    if (!supplierName) {
      return NextResponse.json(
        { error: 'Supplier name is required' },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (body.email && body.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }
    }

    // Validate phone format if provided (flexible for international)
    const validatePhone = (phone) => {
      if (!phone) return true;
      const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
      return phoneRegex.test(phone.replace(/\s/g, ''));
    };

    if (body.phone && !validatePhone(body.phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    if (body.mobile && !validatePhone(body.mobile)) {
      return NextResponse.json(
        { error: 'Invalid mobile number format' },
        { status: 400 }
      );
    }

    // Check for duplicate supplier name
    const existingName = await prisma.supplier.findFirst({
      where: { tenantId: user.tenantId, supplierName }
    });
    if (existingName) {
      return NextResponse.json(
        { error: 'Supplier name already exists' },
        { status: 400 }
      );
    }

    const supplierCode = body.supplierCode?.trim() || await generateSupplierCode();

    // Ensure supplierCode is unique globally (database enforces a global unique constraint)
    const existingCode = await prisma.supplier.findUnique({
      where: { supplierCode }
    });
    if (existingCode) {
      return NextResponse.json(
        { error: 'Supplier code already exists' },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.create({
      data: {
        tenantId: user.tenantId,
        supplierCode,
        supplierName,
        contactPerson: body.contactPerson || null,
        email: body.email || null,
        phone: body.phone || null,
        mobile: body.mobile || null,
        address: body.address || null,
        city: body.city || null,
        country: body.country || 'Malawi',
        postalCode: body.postalCode || null,
        taxId: body.taxId || null,
        paymentTerms: body.paymentTerms ?? 30,
        currency: body.currency || 'MWK',
        creditLimit: body.creditLimit ?? null,
        currentBalance: body.currentBalance ?? 0,
        bankName: body.bankName || null,
        bankAccountNumber: body.bankAccountNumber || null,
        bankBranch: body.bankBranch || null,
        notes: body.notes || null,
        createdById: user.id
      }
    });

    return NextResponse.json({ supplier });
  } catch (error) {
    console.error('Error creating supplier:', error?.message || error);

    // Prisma unique constraint error (supplierCode): return a 409 with a clear message
    if (error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Supplier code already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create supplier. Please try again.' },
      { status: 500 }
    );
  }
}


