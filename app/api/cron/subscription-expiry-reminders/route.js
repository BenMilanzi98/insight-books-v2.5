import { NextResponse } from "next/server";
import { processSubscriptionExpiryReminders } from "@/lib/subscriptionExpiryEmailService";

/**
 * Subscription Expiry Reminders Cron Job API
 * 
 * This endpoint is designed to be called by a cron job service (e.g., Vercel Cron, GitHub Actions, etc.)
 * to automatically send subscription expiry reminder emails to users.
 * 
 * Security: Protected by API key authentication
 * Schedule: Should be called daily (e.g., at 9:00 AM)
 * 
 * Usage:
 * curl -X POST https://yourapp.com/api/cron/subscription-expiry-reminders \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET" \
 *   -H "Content-Type: application/json"
 */

export async function POST(request) {
  try {
    // Security: Verify API key
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;
    
    if (!expectedSecret) {
      console.error('CRON_SECRET environment variable not set');
      return NextResponse.json(
        { error: 'Cron job not configured' },
        { status: 500 }
      );
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const providedSecret = authHeader.replace('Bearer ', '');
    if (providedSecret !== expectedSecret) {
      console.error('Invalid cron secret provided');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log(`Starting subscription expiry reminders cron job at ${new Date().toISOString()}`);

    // Process subscription expiry reminders
    const result = await processSubscriptionExpiryReminders();

    if (!result.success) {
      console.error('Subscription expiry reminders processing failed:', result.error);
      return NextResponse.json(
        { 
          success: false, 
          error: result.error,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }

    console.log('Subscription expiry reminders cron job completed successfully:', {
      twoDaysRemaining: result.twoDaysRemaining,
      oneDayRemaining: result.oneDayRemaining,
      total: result.total,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription expiry reminders processed successfully',
      summary: {
        twoDaysRemaining: result.twoDaysRemaining,
        oneDayRemaining: result.oneDayRemaining,
        total: result.total
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in subscription expiry reminders cron job:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// GET method for testing (development only)
export async function GET(request) {
  // Only allow GET in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Method not allowed in production' },
      { status: 405 }
    );
  }

  try {
    // For development testing, allow GET without authentication
    console.log('Development mode: Processing subscription expiry reminders via GET request');
    
    const result = await processSubscriptionExpiryReminders();
    
    return NextResponse.json({
      success: result.success,
      message: result.success ? 'Subscription expiry reminders processed successfully' : 'Subscription expiry reminders failed',
      summary: result.success ? {
        twoDaysRemaining: result.twoDaysRemaining,
        oneDayRemaining: result.oneDayRemaining,
        total: result.total
      } : null,
      error: result.error,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in development subscription expiry reminders test:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

