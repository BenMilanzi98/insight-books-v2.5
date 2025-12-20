// app/api/reports/trial-balance/export/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { downloadPDF, generateCSV, downloadExcel } from '@/lib/exportUtils';
import { formatCurrency } from '@/lib/currencyUtils';

/**
 * GET - Export trial balance data in requested format
 */
export async function GET(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'pdf';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }
    
    // Define date parameters for the query
    const startDateTime = new Date(startDate);
    startDateTime.setHours(0, 0, 0, 0);
    
    const endDateTime = new Date(endDate);
    endDateTime.setHours(23, 59, 59, 999);
    
    // Fetch accounts and their balances
    const accountsWithTransactions = await prisma.account.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true
      },
      include: {
        journalEntryLines: {
          where: {
            journalEntry: {
              entryDate: {
                gte: startDateTime,
                lte: endDateTime
              },
              status: 'Posted'
            }
          }
        }
      },
      orderBy: {
        accountCode: 'asc'
      }
    });
    
    // Process the accounts to calculate debit and credit balances
    const accounts = accountsWithTransactions.map(account => {
      // Calculate total debits and credits from journal entry lines
      const totalDebits = account.journalEntryLines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
      const totalCredits = account.journalEntryLines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);
      
      // Calculate balance based on normal balance
      let debitBalance = 0;
      let creditBalance = 0;
      
      if (account.normalBalance === 'Debit') {
        const balance = totalDebits - totalCredits;
        if (balance > 0) {
          debitBalance = balance;
        } else if (balance < 0) {
          creditBalance = Math.abs(balance);
        }
      } else {
        const balance = totalCredits - totalDebits;
        if (balance > 0) {
          creditBalance = balance;
        } else if (balance < 0) {
          debitBalance = Math.abs(balance);
        }
      }
      
      return {
        id: account.id,
        code: account.accountCode || account.code || 'N/A',
        name: account.accountName || account.name || 'Unnamed Account',
        type: account.accountType || account.type || 'N/A',
        debit: debitBalance,
        credit: creditBalance
      };
    });
    
    // Get tenant details for the report heading
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { name: true, logoUrl: true }
    });
    
    // Calculate totals
    const totalDebits = accounts.reduce((sum, account) => sum + account.debit, 0);
    const totalCredits = accounts.reduce((sum, account) => sum + account.credit, 0);
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;
    
    // Filter out zero-balance accounts to clean up the report
    const filteredAccounts = accounts.filter(account => account.debit > 0 || account.credit > 0);
    
    // Prepare data for export
    const exportData = {
      title: 'Trial Balance',
      subtitle: `For period: ${startDate} to ${endDate}`,
      companyName: tenant?.name || 'Your Company',
      logo: tenant?.logoUrl,
      data: filteredAccounts,
      headers: [
        { key: 'code', label: 'Account Code' },
        { key: 'name', label: 'Account Name' },
        { key: 'type', label: 'Account Type' },
        { key: 'debit', label: 'Debit', format: 'currency' },
        { key: 'credit', label: 'Credit', format: 'currency' }
      ],
      summary: {
        'Period': `${startDate} to ${endDate}`,
        'Total Debits': totalDebits,
        'Total Credits': totalCredits,
        'Balanced': isBalanced ? 'Yes' : 'No',
        'Difference': isBalanced ? 0 : Math.abs(totalDebits - totalCredits)
      },
      sections: [
        {
          title: 'Balance Status',
          text: isBalanced 
            ? 'The trial balance is in balance (debits equal credits).'
            : `The trial balance is NOT in balance. There is a difference of ${formatCurrency(Math.abs(totalDebits - totalCredits))}.`
        }
      ]
    };
    
    // Generate export in the requested format
    let responseData, fileName, contentType;
    
    switch (format.toLowerCase()) {
      case 'csv':
        const csvData = generateCSV(filteredAccounts, exportData.headers);
        responseData = new Blob([csvData], { type: 'text/csv' });
        fileName = `trial-balance-${startDate}-to-${endDate}.csv`;
        contentType = 'text/csv';
        break;
        
      case 'xlsx':
        // This would use the downloadExcel function in a real implementation
        // For now, we'll return an error
        return NextResponse.json(
          { error: 'Excel export not implemented yet' },
          { status: 501 }
        );
        
      case 'pdf':
      default:
        // Generate PDF with standardized design
        const jsPDF = (await import('jspdf')).default;
        const autoTable = (await import('jspdf-autotable')).default;
        
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });
        
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        let yPos = margin;
        
        // Helper function to format currency
        const formatCurrency = (amount) => {
          return 'MWK ' + new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }).format(amount || 0);
        };
        
        // Company Header
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(tenant?.name || 'Company', pageWidth / 2, yPos, { align: 'center' });
        yPos += 8;
        
        // Report Title
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Trial Balance', pageWidth / 2, yPos, { align: 'center' });
        yPos += 6;
        
        // Period Label
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`For the Period: ${startDate} to ${endDate}`, pageWidth / 2, yPos, { align: 'center' });
        yPos += 10;
        
        // Build table data
        const tableData = filteredAccounts.map(account => [
          account.code,
          account.name,
          account.type,
          formatCurrency(account.debit),
          formatCurrency(account.credit)
        ]);
        
        // Add totals row
        tableData.push([
          '',
          'TOTALS',
          '',
          formatCurrency(totalDebits),
          formatCurrency(totalCredits)
        ]);
        
        // Add table
        autoTable(doc, {
          startY: yPos,
          head: [['Account Code', 'Account Name', 'Account Type', 'Debit', 'Credit']],
          body: tableData,
          theme: 'plain',
          styles: {
            fontSize: 9,
            cellPadding: 3,
            overflow: 'linebreak',
            cellWidth: 'auto'
          },
          headStyles: {
            fillColor: [250, 250, 250],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            halign: 'left'
          },
          bodyStyles: {
            textColor: [0, 0, 0]
          },
          columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 60 },
            2: { cellWidth: 30 },
            3: { halign: 'right', cellWidth: 35 },
            4: { halign: 'right', cellWidth: 35 }
          },
          didParseCell: function (data) {
            // Style totals row
            if (data.row.index === tableData.length - 1) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [240, 240, 240];
            }
          },
          margin: { left: margin, right: margin, top: yPos }
        });
        
        // Add balance status
        yPos = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(isBalanced ? 0 : 255, isBalanced ? 128 : 0, 0);
        doc.text(
          isBalanced 
            ? 'Balance Verification: BALANCED ✓' 
            : `Balance Verification: NOT BALANCED ✗ (Difference: ${formatCurrency(Math.abs(totalDebits - totalCredits))})`,
          margin,
          yPos
        );
        
        responseData = Buffer.from(doc.output('arraybuffer'));
        fileName = `trial-balance-${startDate}-to-${endDate}.pdf`;
        contentType = 'application/pdf';
        break;
    }
    
    // Return the file as a downloadable response
    return new NextResponse(responseData, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });
    
  } catch (error) {
    console.error('Error exporting trial balance:', error);
    return NextResponse.json(
      { error: 'Failed to export trial balance. Please try again.' },
      { status: 500 }
    );
  }
}