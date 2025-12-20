import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Get session cookie - FIXED: Properly await cookies()
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
   
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
   
    try {
      // Parse session data
      const sessionData = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());
     
      if (!sessionData.userId) {
        throw new Error('Invalid session');
      }
     
      // Get user data from database
      const user = await prisma.user.findUnique({
        where: { id: sessionData.userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          tenantId: true,
          isActive: true,
          tenant: sessionData.tenantId ? {
            select: {
              id: true,
              name: true,
              subdomain: true,
              status: true,
              logoUrl: true
            }
          } : undefined
        }
      });
     
      if(!user && sessionData.userId){ 
        cookies().delete('session'); 
      }

      if (!user) {
        throw new Error('User not found');
      }
     
      return NextResponse.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        tenant: user.tenant
      });
     
    } catch (error) {
      console.error('Error parsing session:', error);
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 }
    );
  }
}