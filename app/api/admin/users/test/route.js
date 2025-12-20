import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/admin/users/test - Test endpoint to verify database connection
export async function GET() {
  try {
    // Test basic database connection
    const userCount = await prisma.user.count();
    const tenantCount = await prisma.tenant.count();
    const roleCount = await prisma.role.count();

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      counts: {
        users: userCount,
        tenants: tenantCount,
        roles: roleCount
      }
    });

  } catch (error) {
    console.error('Database test error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Database connection failed',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 