import { NextResponse } from 'next/server';
import { checkAndExpireTrials } from '@/lib/subscriptionService';

export async function POST(request) {
  try {
    // Simple API key protection for cron jobs
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'default-secret-change-in-production';
    
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const expiredCount = await checkAndExpireTrials();

    return NextResponse.json({
      success: true,
      message: `Successfully processed trial expirations`,
      expiredTrials: expiredCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in expire-trials cron job:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process trial expirations',
        details: error.message
      },
      { status: 500 }
    );
  }
}

// GET endpoint for manual testing
export async function GET(request) {
  try {
    // Check if running in development mode for manual testing
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: 'GET method only available in development' },
        { status: 403 }
      );
    }

    const expiredCount = await checkAndExpireTrials();

    return NextResponse.json({
      success: true,
      message: `Manually processed trial expirations`,
      expiredTrials: expiredCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in manual expire-trials:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process trial expirations',
        details: error.message
      },
      { status: 500 }
    );
  }
} 