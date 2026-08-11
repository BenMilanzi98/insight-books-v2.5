import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/serverJwtSecret';


export async function POST(request) {
  try {
    // Get admin token from cookie
    const token = request.cookies.get('admin_token')?.value;
    
    if (token) {
      try {
        const secret = getJwtSecret();
        const decoded = jwt.verify(token, secret);
        if (decoded.isAdmin && decoded.adminId) {
          await prisma.adminAuditLog.create({
            data: {
              adminId: decoded.adminId,
              action: 'LOGOUT',
              entityType: 'ADMIN',
              entityId: decoded.adminId,
              details: 'Admin logged out successfully',
              ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
              userAgent: request.headers.get('user-agent') || 'unknown'
            }
          });
        }
      } catch (error) {
        // Invalid token or JWT misconfiguration — still clear cookie
        console.log('Logout token handling:', error.message);
      }
    }

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Logout successful'
    });

    // Clear admin token cookie
    response.cookies.set('admin_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('Admin logout error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Add other HTTP methods as needed
export async function GET() {
  return NextResponse.json({ message: 'Admin logout endpoint' });
} 