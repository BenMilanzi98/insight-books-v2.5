import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/serverJwtSecret';
import { requirePermission } from '@/lib/auth';

export async function GET(request) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const perm = await requirePermission(request, 'system.view');
    if (perm) return perm;

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    
    const debugInfo = {
      jwtSecret: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
      jwtSecretLength: process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0,
      nodeEnv: process.env.NODE_ENV,
      hasToken: !!token
    };

    if (token) {
      try {
        const decoded = jwt.verify(token, getJwtSecret());
        debugInfo.tokenDecoded = true;
        debugInfo.tokenData = decoded;
      } catch (error) {
        debugInfo.tokenDecoded = false;
        debugInfo.tokenError = error.message;
      }
    }

    return NextResponse.json({
      success: true,
      debug: debugInfo
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    });
  }
} 