// app/api/financial/reports/[id]/export/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { calculateDateRange } from '@/lib/dateUtils';

// GET - Export a report in the specified format
export async function GET(request, { params }) {
  try {
    const reportId = params.id;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'pdf';
    const timeframe = searchParams.get('timeframe') || 'thisMonth';
    const detailed = searchParams.get('detailed') === 'true';
    
    // Calculate date range
    const { startDate, endDate } = calculateDateRange(timeframe);
    
    // First generate the report data by calling the generate endpoint
    const reportResponse = await fetch(`${process.env.NEXTAUTH_URL || process.env.VERCEL_URL || ''}/api/financial/reports/${reportId}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') // Pass cookies for auth
      },
      body: JSON.stringify({
        timeframe,
        detailed
      })
    });
    
    if (!reportResponse.ok) {
      const errorData = await reportResponse.json();
      return NextResponse.json(
        { error: errorData.error || 'Failed to generate report' },
        { status: reportResponse.status }
      );
    }
    
    const reportData = await reportResponse.json();
    
    // Format the report based on the requested format
    switch (format.toLowerCase()) {
      case 'json':
        // Simply return the JSON data
        return NextResponse.json(reportData);
        
      case 'csv':
        // Convert to CSV format
        return exportAsCsv(reportData, reportId, timeframe);
        
      case 'pdf':
        // In a real implementation, you would generate a PDF
        // For this example, we'll return a JSON with PDF generation instructions
        return NextResponse.json({
          message: 'PDF generation would happen server-side in production',
          reportData,
          format: 'pdf'
        });
        
      case 'xlsx':
        // In a real implementation, you would generate an Excel file
        // For this example, we'll return a JSON with Excel generation instructions
        return NextResponse.json({
          message: 'Excel generation would happen server-side in production',
          reportData,
          format: 'xlsx'
        });
        
      default:
        return NextResponse.json(
          { error: 'Unsupported export format' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`Error exporting report ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Failed to export report. Please try again.' },
      { status: 500 }
    );
  }
}

// Helper function to convert report data to CSV
function exportAsCsv(reportData, reportId, timeframe) {
  let csvContent = '';
  
  // Add report title and date range
  csvContent += `"${reportData.title}"\n`;
  if (reportData.period) {
    csvContent += `"Period: ${new Date(reportData.period.startDate).toLocaleDateString()} to ${new Date(reportData.period.endDate).toLocaleDateString()}"\n\n`;
  } else if (reportData.reportDate) {
    csvContent += `"As of: ${new Date(reportData.reportDate).toLocaleDateString()}"\n\n`;
  }
  
  // Process different report types
  switch (reportId) {
    case 'profit-loss':
      // Add summary section
      csvContent += '"SUMMARY"\n';
      csvContent += '"Revenue","Expense","Profit"\n';
      csvContent += `"${reportData.summary.totalRevenue}","${reportData.summary.operatingExpenses + reportData.summary.costOfGoodsSold}","${reportData.summary.netProfit}"\n\n`;
      
      // Add details if available
      if (reportData.details) {
        if (reportData.details.revenueBreakdown) {
          csvContent += '"REVENUE BREAKDOWN"\n';
          csvContent += '"Type","Amount"\n';
          reportData.details.revenueBreakdown.forEach(item => {
            csvContent += `"${item.type}","${item.amount}"\n`;
          });
          csvContent += '\n';
        }
        
        if (reportData.details.expensesByCategory) {
          csvContent += '"EXPENSES BY CATEGORY"\n';
          csvContent += '"Category","Amount"\n';
          reportData.details.expensesByCategory.forEach(item => {
            csvContent += `"${item.category}","${item.amount}"\n`;
          });
        }
      }
      break;
      
    case 'balance-sheet':
      // Add summary section
      csvContent += '"SUMMARY"\n';
      csvContent += '"Total Assets","Total Liabilities","Total Equity"\n';
      csvContent += `"${reportData.summary.totalAssets}","${reportData.summary.totalLiabilities}","${reportData.summary.totalEquity}"\n\n`;
      
      // Add assets section
      csvContent += '"ASSETS"\n';
      csvContent += '"Current Assets"\n';
      csvContent += '"Cash and Equivalents","Accounts Receivable","Inventory","Prepaid Expenses","Total Current Assets"\n';
      csvContent += `"${reportData.assets.current.cashAndEquivalents}","${reportData.assets.current.accountsReceivable}","${reportData.assets.current.inventory}","${reportData.assets.current.prepaidExpenses}","${reportData.assets.current.total}"\n\n`;
      
      csvContent += '"Fixed Assets"\n';
      csvContent += '"Property and Equipment","Accumulated Depreciation","Investments","Total Fixed Assets"\n';
      csvContent += `"${reportData.assets.fixed.propertyAndEquipment}","${reportData.assets.fixed.accumulatedDepreciation}","${reportData.assets.fixed.investments}","${reportData.assets.fixed.total}"\n\n`;
      
      // Add liabilities section
      csvContent += '"LIABILITIES"\n';
      csvContent += '"Current Liabilities"\n';
      csvContent += '"Accounts Payable","Tax Payable","Short-term Loans","Total Current Liabilities"\n';
      csvContent += `"${reportData.liabilities.current.accountsPayable}","${reportData.liabilities.current.taxPayable}","${reportData.liabilities.current.shortTermLoans}","${reportData.liabilities.current.total}"\n\n`;
      
      csvContent += '"Long-term Liabilities"\n';
      csvContent += '"Long-term Loans","Total Long-term Liabilities"\n';
      csvContent += `"${reportData.liabilities.longTerm.longTermLoans}","${reportData.liabilities.longTerm.total}"\n\n`;
      
      // Add equity section
      csvContent += '"EQUITY"\n';
      csvContent += '"Capital Stock","Retained Earnings","Total Equity"\n';
      csvContent += `"${reportData.equity.capitalStock}","${reportData.equity.retainedEarnings}","${reportData.equity.total}"\n`;
      break;
      
    case 'accounts-receivable':
      // Add summary section
      csvContent += '"SUMMARY"\n';
      csvContent += '"Total Receivables","Current Receivables","Past Due Receivables"\n';
      csvContent += `"${reportData.summary.totalReceivables}","${reportData.summary.currentReceivables}","${reportData.summary.pastDueReceivables}"\n\n`;
      
      // Add aging details
      csvContent += '"CURRENT"\n';
      csvContent += '"Invoice Number","Client","Amount","Due Date","Days Past Due"\n';
      reportData.aging.current.forEach(item => {
        csvContent += `"${item.invoiceNumber}","${item.client.name}","${item.amount}","${new Date(item.dueDate).toLocaleDateString()}","${item.daysPastDue}"\n`;
      });
      csvContent += '\n';
      
      csvContent += '"1-30 DAYS PAST DUE"\n';
      csvContent += '"Invoice Number","Client","Amount","Due Date","Days Past Due"\n';
      reportData.aging.oneToThirty.forEach(item => {
        csvContent += `"${item.invoiceNumber}","${item.client.name}","${item.amount}","${new Date(item.dueDate).toLocaleDateString()}","${item.daysPastDue}"\n`;
      });
      csvContent += '\n';
      
      // Continue with other aging buckets
      csvContent += '"31-60 DAYS PAST DUE"\n';
      csvContent += '"Invoice Number","Client","Amount","Due Date","Days Past Due"\n';
      reportData.aging.thirtyOneToSixty.forEach(item => {
        csvContent += `"${item.invoiceNumber}","${item.client.name}","${item.amount}","${new Date(item.dueDate).toLocaleDateString()}","${item.daysPastDue}"\n`;
      });
      csvContent += '\n';
      
      csvContent += '"61-90 DAYS PAST DUE"\n';
      csvContent += '"Invoice Number","Client","Amount","Due Date","Days Past Due"\n';
      reportData.aging.sixtyOneToNinety.forEach(item => {
        csvContent += `"${item.invoiceNumber}","${item.client.name}","${item.amount}","${new Date(item.dueDate).toLocaleDateString()}","${item.daysPastDue}"\n`;
      });
      csvContent += '\n';
      
      csvContent += '"OVER 90 DAYS PAST DUE"\n';
      csvContent += '"Invoice Number","Client","Amount","Due Date","Days Past Due"\n';
      reportData.aging.ninetyPlus.forEach(item => {
        csvContent += `"${item.invoiceNumber}","${item.client.name}","${item.amount}","${new Date(item.dueDate).toLocaleDateString()}","${item.daysPastDue}"\n`;
      });
      break;
      
    // Add other report types similarly
    
    default:
      // For other report types, create a generic export
      csvContent += '"SUMMARY"\n';
      if (reportData.summary) {
        Object.entries(reportData.summary).forEach(([key, value]) => {
          // Format key from camelCase to Title Case
          const formattedKey = key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase());
            
          if (typeof value === 'object') {
            // Skip complex objects
            return;
          }
          
          csvContent += `"${formattedKey}","${value}"\n`;
        });
      }
  }
  
  // Set response headers
  const headers = new Headers();
  headers.append('Content-Type', 'text/csv');
  headers.append('Content-Disposition', `attachment; filename=${reportId}-${timeframe}.csv`);
  
  // Return the CSV content
  return new NextResponse(csvContent, { headers });
}