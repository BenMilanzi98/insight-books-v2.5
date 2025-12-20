import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserFromSession } from '@/lib/auth';

const prisma = new PrismaClient();

export async function PUT(request, { params }) {
  try {
    const session = await getUserFromSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const { name, description, color } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Department name is required' },
        { status: 400 }
      );
    }

    // Check if department exists and belongs to tenant
    const existingDepartment = await prisma.department.findUnique({
      where: { id, tenantId: session.tenantId }
    });

    if (!existingDepartment) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }

    // Check for duplicate name (excluding current department)
    const duplicateDepartment = await prisma.department.findFirst({
      where: {
        name,
        tenantId: session.tenantId,
        NOT: { id }
      }
    });

    if (duplicateDepartment) {
      return NextResponse.json(
        { error: 'Department with this name already exists' },
        { status: 409 }
      );
    }

    const updatedDepartment = await prisma.department.update({
      where: { id },
      data: {
        name,
        description,
        color: color || existingDepartment.color
      }
    });

    return NextResponse.json(updatedDepartment);
  } catch (error) {
    console.error('Error updating department:', error);
    return NextResponse.json(
      { error: 'Failed to update department' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getUserFromSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Check if department exists and belongs to tenant
    const department = await prisma.department.findUnique({
      where: { id, tenantId: session.tenantId },
      include: {
        employees: true
      }
    });

    if (!department) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }

    // Prevent deletion if department has employees
    if (department.employees.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete department with assigned employees' },
        { status: 400 }
      );
    }

    await prisma.department.delete({
      where: { id }
    });

    return NextResponse.json(
      { message: 'Department deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting department:', error);
    return NextResponse.json(
      { error: 'Failed to delete department' },
      { status: 500 }
    );
  }
}