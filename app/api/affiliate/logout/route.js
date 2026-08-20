import { NextResponse } from 'next/server';
import { shouldUseSecureCookies } from '@/lib/sessionCookie';

export async function POST() {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });

    // Clear the affiliate token cookie
    response.cookies.set('affiliate_token', '', {
      httpOnly: true,
      secure: shouldUseSecureCookies(),
      sameSite: 'strict',
      maxAge: 0 // Expire immediately
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, error: 'Logout failed' },
      { status: 500 }
    );
  }
} 