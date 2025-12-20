import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { processDailyReports, getDailyFinancialData } from "@/lib/dailyReportService";

/**
 * Manual Daily Report Test Endpoint
 * 
 * This endpoint allows authorized users to manually trigger daily reports for testing purposes.
 * Only accessible to users with admin permissions.
 */

export async function POST(request) {
  try {
    // Check authentication
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user has admin permissions
    if (!user.role || user.role.name !== 'Admin') {
      return NextResponse.json(
        { error: 'Super Admin access required' },
        { status: 403 }
      );
    }

    // Get request body
    let reportDate = new Date();
    let testMode = false;
    
    try {
      const body = await request.json();
      if (body.date) {
        reportDate = new Date(body.date);
        if (isNaN(reportDate.getTime())) {
          return NextResponse.json(
            { error: 'Invalid date format' },
            { status: 400 }
          );
        }
      }
      testMode = body.testMode || false;
    } catch (error) {
      // Use current date if no body provided
      console.log('No request body provided, using current date');
    }

    console.log(`Manual daily report test triggered by ${user.email} for date: ${reportDate.toISOString()}`);

    if (testMode) {
      // Test mode: Just get financial data without sending emails
      if (!user.tenantId) {
        return NextResponse.json(
          { error: 'No tenant associated with user' },
          { status: 400 }
        );
      }

      const financialData = await getDailyFinancialData(user.tenantId, reportDate);
      
      return NextResponse.json({
        success: true,
        message: 'Test mode: Financial data retrieved successfully',
        data: financialData,
        timestamp: new Date().toISOString(),
        reportDate: reportDate.toISOString()
      });
    }

    // Full mode: Process and send reports
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

    console.log('Manual daily report test completed successfully:', {
      triggeredBy: user.email,
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
      triggeredBy: user.email,
      timestamp: new Date().toISOString(),
      reportDate: reportDate.toISOString()
    });

  } catch (error) {
    console.error('Error in manual daily report test:', error);
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

// GET method for viewing report data without sending emails
export async function GET(request) {
  try {
    // Check authentication
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user has admin permissions
    if (!user.role || user.role.name !== 'Admin') {
      return NextResponse.json(
        { error: 'Super Admin access required' },
        { status: 403 }
      );
    }

    if (!user.tenantId) {
      return NextResponse.json(
        { error: 'No tenant associated with user' },
        { status: 400 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    
    let reportDate = new Date();
    if (dateParam) {
      reportDate = new Date(dateParam);
      if (isNaN(reportDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format' },
          { status: 400 }
        );
      }
    }

    console.log(`Daily report data requested by ${user.email} for date: ${reportDate.toISOString()}`);

    // Get financial data for the user's tenant
    const financialData = await getDailyFinancialData(user.tenantId, reportDate);
    
    return NextResponse.json({
      success: true,
      message: 'Daily report data retrieved successfully',
      data: financialData,
      tenantId: user.tenantId,
      requestedBy: user.email,
      timestamp: new Date().toISOString(),
      reportDate: reportDate.toISOString()
    });

  } catch (error) {
    console.error('Error retrieving daily report data:', error);
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