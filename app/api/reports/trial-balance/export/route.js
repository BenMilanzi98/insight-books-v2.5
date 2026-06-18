// app/api/reports/trial-balance/export/route.js
import { NextResponse } from 'next/server';
import { formatCurrency } from '@/lib/currencyUtils';
import { generateScopedTrialBalance } from '@/lib/reportingEngine/multiTenantReporting';
import { bootstrapReportRoute, auditReportAccess } from '@/lib/reportRouteBootstrap';
import { buildExportHeaderRows } from '@/lib/reportExportScope';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeTrialBalanceRow(account) {
  return {
    code: account.code || account.accountCode,
    name: account.name || account.accountName,
    type: account.type || account.accountType,
    debit: Number(account.debit ?? account.debitBalance ?? account.debitTotal ?? 0),
    credit: Number(account.credit ?? account.creditBalance ?? account.creditTotal ?? 0),
  };
}

/**
 * GET - Export trial balance data in requested format
 */
export async function GET(request) {
  try {
    const boot = await bootstrapReportRoute(request);
    if (boot.error) return boot.error;

    const {
      user,
      tenantIds,
      tenants,
      scope,
      branchScoped,
      branchId: scopeBranchId,
      reportingCurrency,
    } = boot;

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

    const branchIdParam = searchParams.get('branchId');
    const includeZero = (searchParams.get('includeZero') || 'false').toLowerCase() === 'true';
    const effectiveBranchId =
      branchIdParam === 'all' || branchIdParam === ''
        ? null
        : branchIdParam ?? (branchScoped ? scopeBranchId : null);

    const report = await generateScopedTrialBalance({
      tenantIds,
      tenants,
      startDate,
      endDate,
      branchId: effectiveBranchId,
      includeZero,
      scope,
      reportingCurrency,
    });

    await auditReportAccess({
      user,
      reportType: 'trial-balance',
      tenantIds,
      scope,
      filters: { startDate, endDate, includeZero },
      format,
    });

    const exportScope = {
      ...scope,
      consolidation: report.consolidation || scope.consolidation,
    };
    const headerRows = buildExportHeaderRows(exportScope, { startDate, endDate });
    const accounts = (report.accounts || []).map(normalizeTrialBalanceRow);
    const totals = report.totals || report.summary || {};
    const totalDebits = Number(totals.totalDebits ?? report.summary?.totalDebits ?? 0);
    const totalCredits = Number(totals.totalCredits ?? report.summary?.totalCredits ?? 0);
    const isBalanced =
      totals.isBalanced ??
      report.summary?.isBalanced ??
      Math.abs(totalDebits - totalCredits) < 0.01;

    const filteredAccounts = accounts.filter(
      (account) => (account.debit || 0) > 0 || (account.credit || 0) > 0
    );

    const companyName = scope?.businessLabel || tenants[0]?.name || 'Your Company';

    let responseData;
    let fileName;
    let contentType;

    switch (format.toLowerCase()) {
      case 'csv': {
        const csvHeaders = ['Account Code', 'Account Name', 'Account Type', 'Debit', 'Credit'];
        const headerBlock = headerRows.map((r) => `"${r.label}","${r.value}"`).join('\n');
        const tableHeader = csvHeaders.map((h) => `"${h}"`).join(',');
        const rows = filteredAccounts
          .map((account) =>
            [account.code, account.name, account.type, account.debit, account.credit]
              .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
              .join(',')
          )
          .join('\n');
        const totalsRow = ['', 'TOTALS', '', totalDebits, totalCredits]
          .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
          .join(',');
        const csvData = `${headerBlock}\n\n${tableHeader}\n${rows}\n${totalsRow}`;
        responseData = new Blob([csvData], { type: 'text/csv' });
        fileName = `trial-balance-${startDate}-to-${endDate}.csv`;
        contentType = 'text/csv';
        break;
      }

      case 'xlsx':
        return NextResponse.json(
          { error: 'Excel export not implemented yet' },
          { status: 501 }
        );

      case 'pdf':
      default: {
        const jsPDF = (await import('jspdf')).default;
        const autoTable = (await import('jspdf-autotable')).default;

        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        let yPos = margin;

        const formatCurrencyPdf = (amount) => {
          return (
            'MWK ' +
            new Intl.NumberFormat('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(amount || 0)
          );
        };

        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(companyName, pageWidth / 2, yPos, { align: 'center' });
        yPos += 8;

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Trial Balance', pageWidth / 2, yPos, { align: 'center' });
        yPos += 6;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        for (const hdr of headerRows) {
          doc.text(`${hdr.label}: ${hdr.value}`, pageWidth / 2, yPos, { align: 'center' });
          yPos += 4;
        }
        yPos += 4;

        const tableData = filteredAccounts.map((account) => [
          account.code,
          account.name,
          account.type,
          formatCurrencyPdf(account.debit),
          formatCurrencyPdf(account.credit),
        ]);

        tableData.push([
          '',
          'TOTALS',
          '',
          formatCurrencyPdf(totalDebits),
          formatCurrencyPdf(totalCredits),
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Account Code', 'Account Name', 'Account Type', 'Debit', 'Credit']],
          body: tableData,
          theme: 'plain',
          styles: {
            fontSize: 9,
            cellPadding: 3,
            overflow: 'linebreak',
            cellWidth: 'auto',
          },
          headStyles: {
            fillColor: [250, 250, 250],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            halign: 'left',
          },
          bodyStyles: {
            textColor: [0, 0, 0],
          },
          columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 60 },
            2: { cellWidth: 30 },
            3: { halign: 'right', cellWidth: 35 },
            4: { halign: 'right', cellWidth: 35 },
          },
          didParseCell: function (data) {
            if (data.row.index === tableData.length - 1) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [240, 240, 240];
            }
          },
          margin: { left: margin, right: margin, top: yPos },
        });

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
    }

    return new NextResponse(responseData, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting trial balance:', error);
    return NextResponse.json(
      { error: 'Failed to export trial balance. Please try again.' },
      { status: 500 }
    );
  }
}
