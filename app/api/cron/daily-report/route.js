import { NextResponse } from "next/server";
import { processDailyReports } from "@/lib/dailyReportService";

/**
 * Daily Report Cron Job API
 * 
 * This endpoint is designed to be called by a cron job service (e.g., Vercel Cron, GitHub Actions, etc.)
 * to automatically send daily financial reports to master admins.
 * 
 * Security: Protected by API key authentication
 * Schedule: Should be called daily at 8:00 PM (20:00)
 * 
 * Usage:
 * curl -X POST https://yourapp.com/api/cron/daily-report \
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

    // Get optional date parameter (for testing or backfilling)
    let reportDate = new Date();
    try {
      const body = await request.json();
      if (body.date) {
        reportDate = new Date(body.date);
        if (isNaN(reportDate.getTime())) {
          throw new Error('Invalid date format');
        }
      }
    } catch (error) {
      // If no body or invalid JSON, use current date
      console.log('No date provided or invalid JSON, using current date');
    }

    console.log(`Starting daily report cron job for date: ${reportDate.toISOString()}`);

    // Process daily reports
    const result = await processDailyReports(reportDate);

    if (!result.success) {
      console.error('Daily report processing failed:', result.error);
      return NextResponse.json(
        { 
          success: false, 
          error: result.error,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }

    console.log('Daily report cron job completed successfully:', {
      totalAdmins: result.totalAdmins,
      successful: result.successful,
      failed: result.failed,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'Daily reports processed successfully',
      summary: {
        totalAdmins: result.totalAdmins,
        successful: result.successful,
        failed: result.failed
      },
      timestamp: new Date().toISOString(),
      reportDate: reportDate.toISOString()
    });

  } catch (error) {
    console.error('Error in daily report cron job:', error);
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
    console.log('Development mode: Processing daily reports via GET request');
    
    const result = await processDailyReports(new Date());
    
    return NextResponse.json({
      success: result.success,
      message: result.success ? 'Daily reports processed successfully' : 'Daily reports failed',
      summary: result.success ? {
        totalAdmins: result.totalAdmins,
        successful: result.successful,
        failed: result.failed
      } : null,
      error: result.error,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in development daily report test:', error);
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