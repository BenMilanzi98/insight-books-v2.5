import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

export async function PATCH(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    const payroll = await prisma.payroll.update({
      where: { id },
      data: { status }
    });

    return NextResponse.json({ payroll });
  } catch (error) {
    console.error('Error updating payroll status:', error);
    return NextResponse.json(
      { error: 'Failed to update payroll status' },
      { status: 500 }
    );
  }
}



