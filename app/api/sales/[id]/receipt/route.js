// app/api/sales/[id]/receipt/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { getPaymentMethodName } from '@/lib/paymentMethods';

export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const { id: saleId } = resolvedParams;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Fetch sale with related data
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true
          }
        },
        tenant: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            settings: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true
              }
            }
          },
          orderBy: {
            id: 'asc'
          }
        },
        payments: {
          include: {
            allocations: {
              include: {
                paymentAccount: {
                  select: {
                    id: true,
                    name: true,
                    accountType: true
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1 // Get the most recent payment
        }
      }
    });
    
    if (!sale) {
      return NextResponse.json(
        { error: 'Sale not found' },
        { status: 404 }
      );
    }
    
    // Security check: Ensure the sale belongs to the user's tenant
    if (sale.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Get tenant settings
    const tenantSettings = sale.tenant.settings;
    
    // Fetch item taxes if table exists
    let itemTaxesMap = {};
    try {
      const itemTaxes = await prisma.saleItemTax.findMany({
        where: {
          saleItemId: { in: sale.items.map(item => item.id) }
        },
        select: {
          id: true,
          saleItemId: true,
          taxName: true,
          taxCode: true,
          taxRate: true,
          taxAmount: true
        }
      });
      
      // Group by saleItemId
      itemTaxes.forEach(tax => {
        if (!itemTaxesMap[tax.saleItemId]) {
          itemTaxesMap[tax.saleItemId] = [];
        }
        itemTaxesMap[tax.saleItemId].push(tax);
      });
      
      // Attach to items
      sale.items = sale.items.map(item => ({
        ...item,
        itemTaxes: itemTaxesMap[item.id] || []
      }));
    } catch (error) {
      // If table doesn't exist, items won't have itemTaxes - that's okay
      if (!error.message?.includes('does not exist') && !error.message?.includes('Unknown model')) {
        console.error('Error fetching item taxes:', error);
      }
    }
    
    // Debug: Log the logo URL
    console.log('Receipt API - Logo URL:', sale.tenant.logoUrl);
    console.log('Receipt API - Tenant name:', sale.tenant.name);
    
    // ENHANCED: Create the HTML receipt with thermal size and business address
    const receiptHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Receipt - ${sale.saleNumber}</title>
      <style>
        body {
          font-family: "Courier New", monospace;
          margin: 0;
          padding: 0;
          font-size: 11px;
          line-height: 1.3;
          color: #000;
          background: #fff;
          font-weight: bold;
        }
        .receipt {
          width: 72mm;
          max-width: 72mm;
          margin: 0 auto;
          padding: 4mm;
          box-sizing: border-box;
        }
        .header {
          text-align: center;
          margin-bottom: 8px;
          border-bottom: 1px dashed #000;
          padding-bottom: 8px;
        }
        .logo {
          max-width: 40px;
          max-height: 40px;
          margin-bottom: 4px;
          display: block;
          margin-left: auto;
          margin-right: auto;
        }
        .company-name {
          font-size: 14px;
          font-weight: bold;
          margin: 2px 0;
          text-transform: uppercase;
        }
        .business-info {
          font-size: 9px;
          line-height: 1.2;
          margin: 1px 0;
          font-weight: bold;
        }
        .receipt-title {
          font-size: 12px;
          font-weight: bold;
          margin: 8px 0;
          text-align: center;
          border-top: 1px dashed #000;
          border-bottom: 1px dashed #000;
          padding: 4px 0;
          text-transform: uppercase;
        }
        .info-section {
          margin: 6px 0;
          font-size: 10px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
          word-wrap: break-word;
        }
        .info-label {
          font-weight: bold;
          min-width: 30%;
        }
        .info-value {
          text-align: right;
          max-width: 65%;
          word-wrap: break-word;
          font-weight: bold;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 6px 0;
          font-size: 9px;
        }
        .items-header {
          border-bottom: 1px solid #000;
          padding-bottom: 2px;
          margin-bottom: 2px;
        }
        .item-row {
          margin: 2px 0;
          border-bottom: 1px dotted #ccc;
          padding-bottom: 2px;
        }
        .item-name {
          font-weight: bold;
          margin-bottom: 1px;
        }
        .item-details {
          display: flex;
          justify-content: space-between;
          font-size: 8px;
          font-weight: bold;
        }
        .item-qty-price {
          flex: 1;
        }
        .item-amount {
          text-align: right;
          font-weight: bold;
        }
        .totals {
          margin-top: 8px;
          border-top: 1px dashed #000;
          padding-top: 4px;
          font-size: 10px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
        }
        .total-label {
          font-weight: bold;
        }
        .total-amount {
          text-align: right;
          font-weight: bold;
        }
        .grand-total {
          font-size: 12px;
          font-weight: bold;
          border-top: 1px solid #000;
          border-bottom: 1px solid #000;
          padding: 2px 0;
          margin: 4px 0;
        }
        .payment-info {
          margin: 6px 0;
          font-size: 10px;
          text-align: center;
          font-weight: bold;
        }
        .footer {
          margin-top: 10px;
          text-align: center;
          font-size: 9px;
          border-top: 1px dashed #000;
          padding-top: 6px;
          font-weight: bold;
        }
        .custom-footer {
          font-style: italic;
          margin: 4px 0;
          font-weight: bold;
        }
        .copyright {
          font-size: 8px;
          margin-top: 4px;
          font-weight: bold;
        }
        .historical-notice {
          background-color: #fff3cd;
          border: 1px solid #ffc107;
          border-radius: 4px;
          padding: 6px;
          margin: 6px 0;
          font-size: 9px;
        }
        .historical-label {
          color: #856404;
          font-weight: bold;
          min-width: 30%;
        }
        .historical-value {
          color: #856404;
          text-align: right;
          max-width: 65%;
          font-weight: bold;
        }
        .receipt-date-label {
          color: #6c757d;
          font-weight: bold;
          min-width: 30%;
        }
        .receipt-date-value {
          color: #6c757d;
          text-align: right;
          max-width: 65%;
          font-weight: bold;
        }
        
        /* Thermal printer optimizations */
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-size: 10px;
          }
          @page {
            size: 80mm auto;
            margin: 2mm;
          }
          .receipt {
            width: 76mm;
            padding: 2mm;
          }
        }
        
        /* Responsive adjustments for very small screens */
        @media (max-width: 80mm) {
          .receipt {
            width: 100%;
            padding: 2mm;
          }
          .info-row {
            flex-direction: column;
          }
          .info-value {
            text-align: left;
            max-width: 100%;
          }
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <!-- ENHANCED: Header with full business information -->
        <div class="header">
          ${sale.tenant.logoUrl ? `<img src="${sale.tenant.logoUrl.startsWith('http') ? sale.tenant.logoUrl : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${sale.tenant.logoUrl}`}" alt="Logo" class="logo">` : ''}
          <div class="company-name">${sale.tenant.name}</div>
          ${tenantSettings?.buildingName ? `<div class="business-info">${tenantSettings.buildingName}</div>` : ''}
          ${tenantSettings?.businessAddress ? `<div class="business-info">${tenantSettings.businessAddress}</div>` : ''}
          ${tenantSettings?.businessCity ? `<div class="business-info">${tenantSettings.businessCity}</div>` : ''}
          ${tenantSettings?.businessPhone ? `<div class="business-info">Tel: ${tenantSettings.businessPhone}</div>` : ''}
          ${tenantSettings?.businessEmail ? `<div class="business-info">Email: ${tenantSettings.businessEmail}</div>` : ''}
        </div>
        
        <div class="receipt-title">
          RECEIPT #${sale.saleNumber}
        </div>
        
        <!-- ENHANCED: Info section with DD/MM/YYYY date format -->
        <div class="info-section">
          ${sale.isHistorical && sale.historicalDate ? `
          <!-- Historical Sale Notice -->
          <div class="historical-notice">
            <div style="color: #856404; font-weight: bold; margin-bottom: 4px;">📅 HISTORICAL TRANSACTION</div>
            <div class="info-row" style="margin-top: 4px;">
              <span class="historical-label">Sale Date:</span>
              <span class="historical-value">${formatDateDDMMYYYY(sale.historicalDate)} ${formatTime(sale.historicalDate)}</span>
            </div>
            <div class="info-row">
              <span class="receipt-date-label">Receipt Generated:</span>
              <span class="receipt-date-value">${formatDateDDMMYYYY(sale.saleDate)} ${formatTime(sale.saleDate)}</span>
            </div>
          </div>
          ` : `
          <!-- Regular Sale Date -->
          <div class="info-row">
            <span class="info-label">Date:</span>
            <span class="info-value">${formatDateDDMMYYYY(sale.saleDate)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Time:</span>
            <span class="info-value">${formatTime(sale.saleDate)}</span>
          </div>
          `}
          <div class="info-row">
            <span class="info-label">Customer:</span>
            <span class="info-value">${sale.client ? sale.client.name : 'Walk-in Customer'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Cashier:</span>
            <span class="info-value">${sale.createdBy.name}</span>
          </div>
        </div>
        
        <!-- ENHANCED: Items section optimized for thermal receipt -->
        <div class="items-header">
          <strong>ITEMS PURCHASED</strong>
        </div>
        
        ${sale.items.map(item => `
          <div class="item-row">
            <div class="item-name">${item.description}</div>
            <div class="item-details">
              <span class="item-qty-price">${item.quantity} x ${formatCurrency(item.unitPrice, tenantSettings?.currencyCode || 'MWK')}</span>
              <span class="item-amount">${formatCurrency(item.amount, tenantSettings?.currencyCode || 'MWK')}</span>
            </div>
          </div>
        `).join('')}
        
        <!-- ENHANCED: Totals section -->
        <div class="totals">
          <div class="total-row">
            <span class="total-label">Subtotal:</span>
            <span class="total-amount">${formatCurrency(sale.subtotal, tenantSettings?.currencyCode || 'MWK')}</span>
          </div>
          ${sale.totalDiscountAmount > 0 ? `
          <div class="total-row">
            <span class="total-label">Total Discount:</span>
            <span class="total-amount">-${formatCurrency(sale.totalDiscountAmount, tenantSettings?.currencyCode || 'MWK')}</span>
          </div>
          ` : ''}
          ${sale.totalTaxAmount > 0 ? `
          ${(() => {
            // Group taxes by name across all items
            const taxGroups = {};
            sale.items.forEach(item => {
              if (item.itemTaxes && item.itemTaxes.length > 0) {
                item.itemTaxes.forEach(tax => {
                  if (!taxGroups[tax.taxName]) {
                    taxGroups[tax.taxName] = {
                      taxName: tax.taxName,
                      taxCode: tax.taxCode,
                      totalAmount: 0
                    };
                  }
                  taxGroups[tax.taxName].totalAmount += tax.taxAmount || 0;
                });
              }
            });
            
            // If no individual taxes, show total tax
            if (Object.keys(taxGroups).length === 0) {
              return `
              <div class="total-row">
                <span class="total-label">Total Tax:</span>
                <span class="total-amount">${formatCurrency(sale.totalTaxAmount, tenantSettings?.currencyCode || 'MWK')}</span>
              </div>
              `;
            }
            
            // Show individual tax breakdown
            return Object.values(taxGroups).map(tax => `
              <div class="total-row">
                <span class="total-label">${tax.taxName}${tax.taxCode ? ` (${tax.taxCode})` : ''}:</span>
                <span class="total-amount">${formatCurrency(tax.totalAmount, tenantSettings?.currencyCode || 'MWK')}</span>
              </div>
            `).join('') + `
              <div class="total-row" style="border-top: 1px solid #ddd; padding-top: 4px; margin-top: 4px;">
                <span class="total-label"><strong>Total Tax:</strong></span>
                <span class="total-amount"><strong>${formatCurrency(sale.totalTaxAmount, tenantSettings?.currencyCode || 'MWK')}</strong></span>
              </div>
            `;
          })()}
          ` : ''}
          <div class="total-row grand-total">
            <span class="total-label">TOTAL:</span>
            <span class="total-amount">${formatCurrency(sale.total, tenantSettings?.currencyCode || 'MWK')}</span>
          </div>
        </div>
        
        <!-- Payment information -->
        <div class="payment-info">
          ${sale.payments && sale.payments.length > 0 && sale.payments[0].allocations && sale.payments[0].allocations.length > 0 ? `
            <strong>Payment Breakdown:</strong>
            ${sale.payments[0].allocations.map(alloc => `
              <div style="margin-top: 2px; font-size: 9px;">
                ${alloc.paymentAccount.name}: ${formatCurrency(alloc.amount, tenantSettings?.currencyCode || 'MWK')}
              </div>
            `).join('')}
            <div style="margin-top: 4px; font-size: 8px; border-top: 1px dashed #ccc; padding-top: 4px;">
              <strong>Total Paid: ${formatCurrency(sale.payments[0].amount, tenantSettings?.currencyCode || 'MWK')}</strong>
            </div>
          ` : `
            <strong>Payment Method: ${sale.paymentMethod || sale.payments?.[0]?.allocations?.[0]?.paymentAccount?.name || 'N/A'}</strong>
          `}
          ${sale.notes ? `<div style="margin-top: 4px; font-size: 8px;">Notes: ${sale.notes}</div>` : ''}
        </div>
        
        <!-- ENHANCED: Footer with customizable business message -->
        <div class="footer">
          ${tenantSettings?.receiptFooter ? `
          <div class="custom-footer">${tenantSettings.receiptFooter}</div>
          ` : `
          <div class="custom-footer">Thank you for your business!</div>
          `}
          <div class="copyright">${new Date().getFullYear()} © ${sale.tenant.name} | insightbooksafrica.com</div>
        </div>
      </div>
      
      <script>
        // Auto-print when page loads (for thermal printers)
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 500);
        }
        
        // Close window after printing (optional)
        window.onafterprint = function() {
          setTimeout(function() {
            window.close();
          }, 1000);
        }
      </script>
    </body>
    </html>
    `;
    
    // Log the receipt generation in the audit log
    await prisma.auditLog.create({
      data: {
        action: 'RECEIPT_GENERATED',
        entityType: 'SALE',
        entityId: sale.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          saleNumber: sale.saleNumber,
          total: sale.total,
          receiptFormat: 'thermal_enhanced'
        })
      }
    });
    
    // Return HTML response
    return new NextResponse(receiptHtml, {
      headers: {
        'Content-Type': 'text/html',
      }
    });
  } catch (error) {
    console.error(`Error generating receipt for sale ${saleId}:`, error);
    return NextResponse.json(
      { error: 'Failed to generate receipt. Please try again.' },
      { status: 500 }
    );
  }
}

// ENHANCED: Helper function to format currency with better error handling
function formatCurrency(amount, currencyCode = 'MWK') {
  try {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2
    });
    
    return formatter.format(amount);
  } catch (error) {
    // Fallback formatting if currency code is invalid
    return `${currencyCode} ${Number(amount).toFixed(2)}`;
  }
}

// ENHANCED: Helper function to format date in DD/MM/YYYY format
function formatDateDDMMYYYY(date) {
  try {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    return 'Invalid Date';
  }
}

// ENHANCED: Helper function to format time
function formatTime(date) {
  try {
    const d = new Date(date);
    return d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch (error) {
    return 'Invalid Time';
  }
}