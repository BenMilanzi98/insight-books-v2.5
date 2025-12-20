import prisma from '@/lib/prisma';
import { sendDailyReportEmail } from '@/lib/email';

/**
 * Daily Report Service
 * Generates comprehensive daily financial summaries for master admins
 */

// Get all master admin users across all tenants
export async function getMasterAdmins() {
  try {
    const masterAdmins = await prisma.user.findMany({
      where: {
        role: {
          name: 'Admin'
        },
        isActive: true,
        isEmailVerified: true
      },
      include: {
        role: true,
        tenant: true
      }
    });

    return masterAdmins;
  } catch (error) {
    console.error('Error fetching master admins:', error);
    return [];
  }
}

// Get daily financial data for a specific tenant
export async function getDailyFinancialData(tenantId, reportDate = new Date()) {
  try {
    const startOfDay = new Date(reportDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(reportDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get sales data (POS + Invoices)
    const [salesData, invoiceData] = await Promise.all([
      prisma.sale.aggregate({
        where: {
          tenantId,
          saleDate: { gte: startOfDay, lte: endOfDay },
          status: 'completed'
        },
        _sum: { total: true },
        _count: { id: true }
      }),
      prisma.invoice.aggregate({
        where: {
          tenantId,
          issueDate: { gte: startOfDay, lte: endOfDay },
          status: { in: ['Paid', 'Pending'] }
        },
        _sum: { total: true },
        _count: { id: true }
      })
    ]);

    // Get expenses data
    const expensesData = await prisma.expense.aggregate({
      where: {
        tenantId,
        date: { gte: startOfDay, lte: endOfDay },
        status: { in: ['Approved', 'Pending'] }
      },
      _sum: { amount: true },
      _count: { id: true }
    });

    // Get expenses breakdown by category
    const expensesByCategory = await prisma.expense.groupBy({
      by: ['category'],
      where: {
        tenantId,
        date: { gte: startOfDay, lte: endOfDay },
        status: { in: ['Approved', 'Pending'] }
      },
      _sum: { amount: true },
      _count: { id: true }
    });

    // Get outstanding invoices
    const outstandingInvoices = await prisma.invoice.aggregate({
      where: {
        tenantId,
        status: 'Pending'
      },
      _sum: { total: true },
      _count: { id: true }
    });

    // Get tax-related data (if available)
    const taxData = await prisma.invoice.aggregate({
      where: {
        tenantId,
        issueDate: { gte: startOfDay, lte: endOfDay },
        status: { in: ['Paid', 'Pending'] }
      },
      _sum: { 
        taxAmount: true,
        total: true 
      }
    });

    // Calculate totals
    const totalSales = (salesData._sum.total || 0) + (invoiceData._sum.total || 0);
    const totalExpenses = expensesData._sum.amount || 0;
    const netProfit = totalSales - totalExpenses;
    const profitMargin = totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(2) : 0;

    return {
      date: reportDate,
      sales: {
        pos: {
          amount: salesData._sum.total || 0,
          count: salesData._count.id || 0
        },
        invoices: {
          amount: invoiceData._sum.total || 0,
          count: invoiceData._count.id || 0
        },
        total: totalSales
      },
      expenses: {
        total: totalExpenses,
        count: expensesData._count.id || 0,
        byCategory: expensesByCategory.map(cat => ({
          category: cat.category,
          amount: cat._sum.amount || 0,
          count: cat._count.id || 0
        }))
      },
      profit: {
        net: netProfit,
        margin: parseFloat(profitMargin)
      },
      outstanding: {
        amount: outstandingInvoices._sum.total || 0,
        count: outstandingInvoices._count.id || 0
      },
      tax: {
        collected: taxData._sum.taxAmount || 0,
        totalRevenue: taxData._sum.total || 0
      }
    };
  } catch (error) {
    console.error('Error fetching daily financial data:', error);
    throw error;
  }
}

// Generate HTML email template for daily report
export function generateDailyReportHTML(tenantName, financialData) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MWK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount).replace('MWK', 'MWK');
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const profitColor = financialData.profit.net >= 0 ? '#10B981' : '#EF4444';
  const profitIcon = financialData.profit.net >= 0 ? '📈' : '📉';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Daily Financial Report - ${tenantName}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #4338ca, #6366f1); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 28px; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
        .summary-card h3 { margin: 0 0 10px 0; color: #6b7280; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
        .summary-card .amount { font-size: 24px; font-weight: bold; margin: 5px 0; }
        .summary-card .subtitle { font-size: 12px; color: #9ca3af; }
        .section { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .section h2 { margin: 0 0 20px 0; color: #374151; font-size: 18px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
        .table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        .table th { background-color: #f9fafb; font-weight: 600; color: #374151; }
        .table tr:hover { background-color: #f9fafb; }
        .profit-positive { color: #10B981; }
        .profit-negative { color: #EF4444; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
        .metric-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
        .metric-row:last-child { border-bottom: none; }
        .metric-label { font-weight: 500; }
        .metric-value { font-weight: 600; }
        @media (max-width: 600px) {
          .summary-grid { grid-template-columns: 1fr; }
          .table { font-size: 12px; }
          .table th, .table td { padding: 8px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 Daily Financial Report</h1>
          <p>${tenantName} • ${formatDate(financialData.date)}</p>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <h3>Total Sales</h3>
            <div class="amount">${formatCurrency(financialData.sales.total)}</div>
            <div class="subtitle">${financialData.sales.pos.count + financialData.sales.invoices.count} transactions</div>
          </div>
          
          <div class="summary-card">
            <h3>Total Expenses</h3>
            <div class="amount">${formatCurrency(financialData.expenses.total)}</div>
            <div class="subtitle">${financialData.expenses.count} expenses</div>
          </div>
          
          <div class="summary-card">
            <h3>Net Profit</h3>
            <div class="amount" style="color: ${profitColor}">${profitIcon} ${formatCurrency(financialData.profit.net)}</div>
            <div class="subtitle">${financialData.profit.margin}% margin</div>
          </div>
          
          <div class="summary-card">
            <h3>Outstanding</h3>
            <div class="amount">${formatCurrency(financialData.outstanding.amount)}</div>
            <div class="subtitle">${financialData.outstanding.count} unpaid invoices</div>
          </div>
        </div>

        <div class="section">
          <h2>📈 Sales Breakdown</h2>
          <div class="metric-row">
            <span class="metric-label">POS Sales:</span>
            <span class="metric-value">${formatCurrency(financialData.sales.pos.amount)} (${financialData.sales.pos.count} transactions)</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Invoice Sales:</span>
            <span class="metric-value">${formatCurrency(financialData.sales.invoices.amount)} (${financialData.sales.invoices.count} invoices)</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Total Revenue:</span>
            <span class="metric-value" style="font-size: 18px; color: #4338ca;">${formatCurrency(financialData.sales.total)}</span>
          </div>
        </div>

        <div class="section">
          <h2>💰 Expenses by Category</h2>
          <table class="table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Amount</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              ${financialData.expenses.byCategory.map(cat => `
                <tr>
                  <td>${cat.category}</td>
                  <td>${formatCurrency(cat.amount)}</td>
                  <td>${cat.count}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>📋 Tax Summary</h2>
          <div class="metric-row">
            <span class="metric-label">Tax Collected:</span>
            <span class="metric-value">${formatCurrency(financialData.tax.collected)}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Taxable Revenue:</span>
            <span class="metric-value">${formatCurrency(financialData.tax.totalRevenue)}</span>
          </div>
        </div>

        <div class="footer">
          <p>This report was automatically generated by InsightBooks on ${formatDate(financialData.date)}</p>
          <p>© ${new Date().getFullYear()} InsightBooks. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Generate plain text version for email fallback
export function generateDailyReportText(tenantName, financialData) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MWK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount).replace('MWK', 'MWK');
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return `
DAILY FINANCIAL REPORT
${tenantName} • ${formatDate(financialData.date)}

SUMMARY:
• Total Sales: ${formatCurrency(financialData.sales.total)}
• Total Expenses: ${formatCurrency(financialData.expenses.total)}
• Net Profit: ${formatCurrency(financialData.profit.net)} (${financialData.profit.margin}% margin)
• Outstanding Invoices: ${formatCurrency(financialData.outstanding.amount)}

SALES BREAKDOWN:
• POS Sales: ${formatCurrency(financialData.sales.pos.amount)} (${financialData.sales.pos.count} transactions)
• Invoice Sales: ${formatCurrency(financialData.sales.invoices.amount)} (${financialData.sales.invoices.count} invoices)

EXPENSES BY CATEGORY:
${financialData.expenses.byCategory.map(cat => `• ${cat.category}: ${formatCurrency(cat.amount)} (${cat.count} items)`).join('\n')}

TAX SUMMARY:
• Tax Collected: ${formatCurrency(financialData.tax.collected)}
• Taxable Revenue: ${formatCurrency(financialData.tax.totalRevenue)}

---
Generated by InsightBooks on ${formatDate(financialData.date)}
  `.trim();
}

// Send daily report to a specific master admin
export async function sendDailyReportToAdmin(admin, reportDate = new Date()) {
  try {
    if (!admin.tenantId) {
      console.log(`Skipping admin ${admin.email} - no tenant associated`);
      return { success: false, error: 'No tenant associated' };
    }

    // Get tenant information
    const tenant = await prisma.tenant.findUnique({
      where: { id: admin.tenantId }
    });

    if (!tenant) {
      console.log(`Skipping admin ${admin.email} - tenant not found`);
      return { success: false, error: 'Tenant not found' };
    }

    // Get daily financial data
    const financialData = await getDailyFinancialData(admin.tenantId, reportDate);

    // Generate email content
    const htmlContent = generateDailyReportHTML(tenant.name, financialData);
    const textContent = generateDailyReportText(tenant.name, financialData);

    // Send email
    const emailResult = await sendDailyReportEmail(
      admin.email,
      admin.name || 'Master Admin',
      tenant.name,
      financialData.date,
      htmlContent,
      textContent
    );

    // Check if email was sent successfully
    if (!emailResult.success) {
      console.log(`Failed to send email to ${admin.email}:`, emailResult.error);
      return {
        success: false,
        adminEmail: admin.email,
        tenantName: tenant.name,
        error: emailResult.error,
        emailResult
      };
    }

    console.log(`Successfully sent email to ${admin.email}`);
    return {
      success: true,
      adminEmail: admin.email,
      tenantName: tenant.name,
      emailResult
    };
  } catch (error) {
    console.error(`Error sending daily report to ${admin.email}:`, error);
    return {
      success: false,
      adminEmail: admin.email,
      error: error.message
    };
  }
}

// Process daily reports for all master admins
export async function processDailyReports(reportDate = new Date()) {
  try {
    console.log(`Starting daily report processing for ${reportDate.toDateString()}`);

    // Get all master admins
    const masterAdmins = await getMasterAdmins();
    
    if (masterAdmins.length === 0) {
      console.log('No master admins found');
      return { success: false, error: 'No master admins found' };
    }

    console.log(`Found ${masterAdmins.length} master admin(s)`);

    // Send reports to each admin
    const results = [];
    for (const admin of masterAdmins) {
      console.log(`Processing report for admin: ${admin.email}`);
      const result = await sendDailyReportToAdmin(admin, reportDate);
      results.push(result);
      
      // Add small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Log summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`Daily report processing completed: ${successful} successful, ${failed} failed`);

    return {
      success: true,
      totalAdmins: masterAdmins.length,
      successful,
      failed,
      results
    };
  } catch (error) {
    console.error('Error processing daily reports:', error);
    return {
      success: false,
      error: error.message
    };
  }
} 