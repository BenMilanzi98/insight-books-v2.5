import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserFromSession } from '@/lib/auth';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const session = await getUserFromSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const departments = await prisma.department.findMany({
      where: {
        tenantId: session.tenantId
      },
      orderBy: {
        name: 'asc'
      },
      // Make sure the id field is included in the response
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

export async function POST(request) {
  try {
    const session = await getUserFromSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, description, color } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Department name is required' },
        { status: 400 }
      );
    }

    const existingDepartment = await prisma.department.findFirst({
      where: {
        name,
        tenantId: session.tenantId
      }
    });

    if (existingDepartment) {
      return NextResponse.json(
        { error: 'Department with this name already exists' },
        { status: 409 }
      );
    }

    const department = await prisma.department.create({
      data: {
        name,
        description,
        color: color || '#4f46e5',
        tenantId: session.tenantId
      }
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error) {
    console.error('Error creating department:', error);
    return NextResponse.json(
      { error: 'Failed to create department' },
      { status: 500 }
    );
  }
}