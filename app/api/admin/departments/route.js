import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';

// GET - list departments for a tenant (optional tenantId for admin)
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    const where = tenantId ? { tenantId } : {};
    const departments = await prisma.department.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        tenantId: true
      }
    });

    return NextResponse.json(departments);
  } catch (error) {
    console.error('Error fetching departments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch departments' },
      { status: 500 }
    );
  }
}

// POST - create department for a tenant (admin)
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tenantId, name, description, color } = body;

    if (!name || !tenantId) {
      return NextResponse.json(
        { error: 'Tenant and department name are required' },
        { status: 400 }
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const existingDepartment = await prisma.department.findFirst({
      where: {
        name: name.trim(),
        tenantId
      }
    });

    if (existingDepartment) {
      return NextResponse.json(
        { error: 'A department with this name already exists for this tenant' },
        { status: 409 }
      );
    }

    const department = await prisma.department.create({
      data: {
        name: name.trim(),
        description: description || null,
        color: color || '#4f46e5',
        tenantId
      }
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error) {
    console.error('Error creating department:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A department with this name already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create department' },
      { status: 500 }
    );
  }
}
