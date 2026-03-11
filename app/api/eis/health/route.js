import { NextResponse } from 'next/server';
import eisService from '@/lib/eisService';

export async function GET() {
  try {
    const health = await eisService.getHealthStatus();
    return NextResponse.json(health, { status: health.mraConnected ? 200 : 503 });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      mraConnected: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }
}
