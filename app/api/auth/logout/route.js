import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { parseSessionPayload } from '@/lib/sessionCookie';

export async function POST(request) {
  try {
    // Get session cookie to extract user ID for logging
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    if (sessionCookie) {
      try {
        // Parse session data to get user ID for audit log (v2 or legacy)
        const sessionData = parseSessionPayload(sessionCookie.value);
        
        if (sessionData?.userId) {
          // Log the logout action
          await prisma.auditLog.create({
            data: {
              action: 'USER_LOGOUT',
              entityType: 'USER',
              entityId: sessionData.userId,
              userId: sessionData.userId,
              tenantId: sessionData.tenantId
            }
          });
        }
      } catch (error) {
        console.error('Error parsing session for logout:', error);
      }
    }
    
    // Clear the session cookie
    cookieStore.delete('session');
    
    // Return success response
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'An error occurred during logout' },
      { status: 500 }
    );
  }
}