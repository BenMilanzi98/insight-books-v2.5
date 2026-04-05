// app/api/sales/[id]/receipt/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { getPaymentMethodName } from '@/lib/paymentMethods';
import { textToMinimalPdf } from '@/lib/fallback-text-pdf';

export async function GET(request, { params }) {
  const resolvedParams = typeof params.then === 'function' ? await params : params;
  const saleId = resolvedParams?.id ?? null;
  try {
    if (!saleId) {
      return NextResponse.json({ error: 'Sale ID required' }, { status: 400 });
    }
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
            logoUrl: true
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

    // Fetch tenant settings separately (avoids failing whole receipt if settings table/relation has issues)
    let tenantSettings = null;
    try {
      const settings = await prisma.tenantSettings.findUnique({
        where: { tenantId: sale.tenantId }
      });
      tenantSettings = settings ?? null;
    } catch (settingsErr) {
      console.warn('Receipt: could not load tenant settings:', settingsErr?.message || settingsErr);
    }
    
    // Fetch item taxes if table exists (skip when no items to avoid Prisma in: [] issues)
    let itemTaxesMap = {};
    const itemIds = Array.isArray(sale.items) ? sale.items.map(item => item.id) : [];
    try {
      if (itemIds.length === 0) {
        // No items - ensure each item has itemTaxes and numeric fields
        sale.items = (sale.items || []).map(item => ({
          ...item,
          itemTaxes: [],
          amount: typeof item.amount === 'object' && item.amount?.toNumber ? item.amount.toNumber() : parseFloat(item.amount || 0),
          taxAmount: typeof item.taxAmount === 'object' && item.taxAmount?.toNumber ? item.taxAmount.toNumber() : parseFloat(item.taxAmount || 0)
        }));
      } else {
      const itemTaxes = await prisma.saleItemTax.findMany({
        where: {
          saleItemId: { in: itemIds }
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
      
      // Attach to items and ensure proper serialization
      sale.items = sale.items.map(item => {
        const itemTaxes = (itemTaxesMap[item.id] || []).map(tax => ({
          id: tax.id,
          saleItemId: tax.saleItemId,
          taxName: tax.taxName || null,
          taxCode: tax.taxCode || null,
          taxRate: typeof tax.taxRate === 'object' && tax.taxRate?.toNumber ? tax.taxRate.toNumber() : parseFloat(tax.taxRate || 0),
          taxAmount: typeof tax.taxAmount === 'object' && tax.taxAmount?.toNumber ? tax.taxAmount.toNumber() : parseFloat(tax.taxAmount || 0)
        }));
        
        return {
          ...item,
          itemTaxes: itemTaxes,
          // Ensure numeric fields are properly converted
          amount: typeof item.amount === 'object' && item.amount?.toNumber ? item.amount.toNumber() : parseFloat(item.amount || 0),
          taxAmount: typeof item.taxAmount === 'object' && item.taxAmount?.toNumber ? item.taxAmount.toNumber() : parseFloat(item.taxAmount || 0)
        };
      });
      
      // Debug: Log tax data
      console.log('Receipt API - Item taxes fetched:', itemTaxes.length);
      console.log('Receipt API - Items with taxes:', sale.items.map(item => ({
        id: item.id,
        description: item.description,
        taxCount: item.itemTaxes?.length || 0,
        taxes: item.itemTaxes
      })));
      }
    } catch (error) {
      // If table doesn't exist, items won't have itemTaxes - that's okay
      if (!error.message?.includes('does not exist') && !error.message?.includes('Unknown model')) {
        console.error('Error fetching item taxes:', error);
      }
    }
    
    // Ensure sale.totalTaxAmount is a number (not Decimal)
    sale.totalTaxAmount = typeof sale.totalTaxAmount === 'object' && sale.totalTaxAmount?.toNumber 
      ? sale.totalTaxAmount.toNumber() 
      : parseFloat(sale.totalTaxAmount || 0);
    sale.subtotal = typeof sale.subtotal === 'object' && sale.subtotal?.toNumber 
      ? sale.subtotal.toNumber() 
      : parseFloat(sale.subtotal || 0);
    sale.total = typeof sale.total === 'object' && sale.total?.toNumber 
      ? sale.total.toNumber() 
      : parseFloat(sale.total || 0);
    sale.totalDiscountAmount = typeof sale.totalDiscountAmount === 'object' && sale.totalDiscountAmount?.toNumber 
      ? sale.totalDiscountAmount.toNumber() 
      : parseFloat(sale.totalDiscountAmount || 0);
    sale.posAmountTendered =
      sale.posAmountTendered != null && sale.posAmountTendered !== ''
        ? typeof sale.posAmountTendered === 'object' && sale.posAmountTendered?.toNumber
          ? sale.posAmountTendered.toNumber()
          : parseFloat(sale.posAmountTendered)
        : null;
    sale.posChangeGiven =
      sale.posChangeGiven != null && sale.posChangeGiven !== ''
        ? typeof sale.posChangeGiven === 'object' && sale.posChangeGiven?.toNumber
          ? sale.posChangeGiven.toNumber()
          : parseFloat(sale.posChangeGiven)
        : null;
    if (sale.posAmountTendered != null && Number.isNaN(sale.posAmountTendered)) sale.posAmountTendered = null;
    if (sale.posChangeGiven != null && Number.isNaN(sale.posChangeGiven)) sale.posChangeGiven = null;
    
    // Debug: Log the logo URL and tax summary
    console.log('Receipt API - Logo URL:', sale.tenant.logoUrl);
    console.log('Receipt API - Tenant name:', sale.tenant.name);
    console.log('Receipt API - Total Tax Amount:', sale.totalTaxAmount);
    console.log('Receipt API - Sale Items Count:', sale.items.length);
    console.log('Receipt API - Items with taxes:', JSON.stringify(sale.items.map(item => ({
      id: item.id,
      description: item.description,
      taxCount: item.itemTaxes?.length || 0,
      taxes: item.itemTaxes?.map(t => ({ name: t.taxName, amount: t.taxAmount })) || []
    })), null, 2));
    
    // Process taxes for receipt display
    // IMPORTANT: taxAmount in SaleItemTax is already the total tax for that line item
    // (quantity × unitPrice × taxRate), so we just sum them up
    const processTaxesForReceipt = (items, totalTaxAmount) => {
      const taxGroups = {};
      let hasAnyTaxes = false;
      let totalTaxFromItems = 0;
      
      // Convert items to plain array
      const itemsArray = Array.isArray(items) ? items : [];
      
      itemsArray.forEach((item, itemIndex) => {
        const itemTaxes = item.itemTaxes || [];
        const itemQuantity = parseFloat(item.quantity || 1);
        const itemUnitPrice = parseFloat(item.unitPrice || 0);
        const itemSubtotal = itemQuantity * itemUnitPrice;
        
        if (itemTaxes.length > 0) {
          hasAnyTaxes = true;
          itemTaxes.forEach(tax => {
            const taxKey = (tax.taxName || tax.taxId || 'Tax').trim();
            // tax.taxAmount is already the total tax for this line item (includes quantity)
            const taxAmount = parseFloat(tax.taxAmount || 0);
            
            if (!taxGroups[taxKey]) {
              taxGroups[taxKey] = {
                taxName: tax.taxName || tax.taxId || 'Tax',
                taxCode: tax.taxCode || null,
                totalAmount: 0
              };
            }
            // Sum up the tax amounts (each taxAmount already includes quantity)
            taxGroups[taxKey].totalAmount += taxAmount;
            totalTaxFromItems += taxAmount;
            
            console.log(`Receipt Tax Processing - Item ${itemIndex + 1}: ${item.description}, Qty: ${itemQuantity}, Tax: ${tax.taxName}, Amount: ${taxAmount}, Running Total: ${taxGroups[taxKey].totalAmount}`);
          });
        } else if (item.taxAmount && parseFloat(item.taxAmount) > 0) {
          // Fallback: use item-level taxAmount if no itemTaxes
          // This taxAmount should also already include quantity
          hasAnyTaxes = true;
          const taxKey = item.taxDescription || 'Tax';
          const taxAmount = parseFloat(item.taxAmount || 0);
          
          if (!taxGroups[taxKey]) {
            taxGroups[taxKey] = {
              taxName: item.taxDescription || 'Tax',
              taxCode: null,
              totalAmount: 0
            };
          }
          taxGroups[taxKey].totalAmount += taxAmount;
          totalTaxFromItems += taxAmount;
        }
      });
      
      const sortedTaxGroups = Object.values(taxGroups).sort((a, b) => (a.taxName || '').localeCompare(b.taxName || ''));
      
      console.log('Receipt Tax Summary:', {
        totalTaxFromItems,
        saleTotalTaxAmount: totalTaxAmount,
        taxGroups: sortedTaxGroups.map(t => ({ name: t.taxName, amount: t.totalAmount }))
      });
      
      return {
        taxGroups: sortedTaxGroups,
        hasAnyTaxes,
        totalTaxFromItems,
        // Use calculated total from items if available, otherwise use sale.totalTaxAmount
        totalTaxAmount: totalTaxFromItems > 0 ? totalTaxFromItems : parseFloat(totalTaxAmount || 0)
      };
    };
    
    const taxData = processTaxesForReceipt(sale.items, sale.totalTaxAmount);
    console.log('Receipt API - Processed tax data:', JSON.stringify(taxData, null, 2));
    
    // ENHANCED: Create the HTML receipt with thermal size and business address
    const receiptHtml = `
    <!DOCTYPE html>
    <html class="thermal-receipt" lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Receipt - ${sale.saleNumber}</title>
      <style>
        *, *::before, *::after { box-sizing: border-box; }
        html.thermal-receipt {
          margin: 0;
          padding: 0;
          height: auto;
          min-height: 0;
        }
        body {
          font-family: "Courier New", monospace;
          margin: 0;
          padding: 0;
          font-size: 11px;
          line-height: 1.3;
          color: #000;
          background: #fff;
          font-weight: bold;
          height: auto;
          min-height: 0;
        }
        .receipt {
          width: 72mm;
          max-width: 72mm;
          margin: 0 auto;
          padding: 4mm;
          box-sizing: border-box;
          overflow: visible;
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
        
        /* Thermal printer optimizations — end print right after content + fixed 10px feed (no extra roll) */
        @media print {
          html.thermal-receipt,
          html.thermal-receipt body {
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-size: 10px;
          }
          @page {
            size: 80mm auto;
            /* Outer margin adds blank beyond content on many thermal drivers — keep 0 */
            margin: 0;
          }
          .receipt {
            width: 80mm;
            max-width: 80mm;
            /* Sides/top in mm; exactly 10px white after last line (matches JS TAIL_PX) */
            /* 10px = only trailing feed after last printed line */
            padding: 2mm 2mm 10px 2mm;
            margin: 0 auto;
            margin-bottom: 0 !important;
            page-break-after: auto;
            break-after: auto;
            overflow: visible;
          }
          .footer,
          .copyright {
            margin-bottom: 0 !important;
            padding-bottom: 0 !important;
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
        
        ${sale.items.map(item => {
          // Calculate item subtotal (before tax) = quantity × unitPrice - discount
          const itemQuantity = parseFloat(item.quantity || 1);
          const itemUnitPrice = parseFloat(item.unitPrice || 0);
          const itemDiscountAmount = parseFloat(item.discountAmount || 0);
          const itemSubtotal = (itemQuantity * itemUnitPrice) - itemDiscountAmount;
          
          const itemTaxes = item.itemTaxes || [];
          
          // Group taxes for this item
          const itemTaxGroups = {};
          let itemTaxTotal = 0;
          
          itemTaxes.forEach(tax => {
            const taxKey = (tax.taxName || tax.taxId || 'Tax').trim();
            const taxAmount = parseFloat(tax.taxAmount || 0);
            
            if (!itemTaxGroups[taxKey]) {
              itemTaxGroups[taxKey] = {
                taxName: tax.taxName || tax.taxId || 'Tax',
                taxCode: tax.taxCode || null,
                totalAmount: 0
              };
            }
            itemTaxGroups[taxKey].totalAmount += taxAmount;
            itemTaxTotal += taxAmount;
          });
          
          // Fallback: use item.taxAmount if no itemTaxes
          if (itemTaxTotal === 0 && item.taxAmount) {
            itemTaxTotal = parseFloat(item.taxAmount || 0);
          }
          
          // Item total = subtotal + taxes
          const itemTotal = itemSubtotal + itemTaxTotal;
          
          return `
          <div class="item-row">
            <div class="item-name">${item.description}</div>
            <div class="item-details">
              <span class="item-qty-price">${itemQuantity} x ${formatCurrency(itemUnitPrice, tenantSettings?.currencyCode || 'MWK')}</span>
              <span class="item-amount">${formatCurrency(itemSubtotal, tenantSettings?.currencyCode || 'MWK')}</span>
            </div>
            ${itemDiscountAmount > 0 ? `
            <div style="font-size: 7px; margin-top: 1px; padding-left: 4px; color: #999;">
              <div style="display: flex; justify-content: space-between;">
                <span>Discount:</span>
                <span>-${formatCurrency(itemDiscountAmount, tenantSettings?.currencyCode || 'MWK')}</span>
              </div>
            </div>
            ` : ''}
            ${Object.keys(itemTaxGroups).length > 0 ? `
            <div style="font-size: 7px; margin-top: 2px; padding-left: 4px; color: #666;">
              ${Object.values(itemTaxGroups).map(tax => `
                <div style="display: flex; justify-content: space-between;">
                  <span>${tax.taxName}${tax.taxCode ? ` (${tax.taxCode})` : ''}:</span>
                  <span>${formatCurrency(tax.totalAmount, tenantSettings?.currencyCode || 'MWK')}</span>
                </div>
              `).join('')}
            </div>
            ` : itemTaxTotal > 0 ? `
            <div style="font-size: 7px; margin-top: 2px; padding-left: 4px; color: #666;">
              <div style="display: flex; justify-content: space-between;">
                <span>Tax:</span>
                <span>${formatCurrency(itemTaxTotal, tenantSettings?.currencyCode || 'MWK')}</span>
              </div>
            </div>
            ` : ''}
            <div class="item-details" style="margin-top: 2px; border-top: 1px dotted #ddd; padding-top: 2px;">
              <span class="item-qty-price" style="font-weight: bold;">Item Total:</span>
              <span class="item-amount" style="font-weight: bold;">${formatCurrency(itemTotal, tenantSettings?.currencyCode || 'MWK')}</span>
            </div>
          </div>
        `;
        }).join('')}
        
        <!-- ENHANCED: Totals section -->
        <div class="totals">
          <div class="total-row">
            <span class="total-label">Subtotal (Before Tax):</span>
            <span class="total-amount">${formatCurrency(sale.subtotal, tenantSettings?.currencyCode || 'MWK')}</span>
          </div>
          ${sale.totalDiscountAmount > 0 ? `
          <div class="total-row">
            <span class="total-label">Total Discount:</span>
            <span class="total-amount">-${formatCurrency(sale.totalDiscountAmount, tenantSettings?.currencyCode || 'MWK')}</span>
          </div>
          ` : ''}
          ${(() => {
            // Use pre-processed tax data
            const { taxGroups, hasAnyTaxes, totalTaxAmount } = taxData;
            
            // If we have individual taxes, show them
            if (hasAnyTaxes && taxGroups.length > 0) {
              const taxRows = taxGroups.map(tax => {
                const amount = parseFloat(tax.totalAmount || 0);
                return `
                  <div class="total-row">
                    <span class="total-label">${tax.taxName}${tax.taxCode ? ` (${tax.taxCode})` : ''}:</span>
                    <span class="total-amount">${formatCurrency(amount, tenantSettings?.currencyCode || 'MWK')}</span>
                  </div>
                `;
              }).join('');
              
              return taxRows + `
                <div class="total-row" style="border-top: 1px solid #ddd; padding-top: 4px; margin-top: 4px;">
                  <span class="total-label"><strong>Total Tax:</strong></span>
                  <span class="total-amount"><strong>${formatCurrency(totalTaxAmount, tenantSettings?.currencyCode || 'MWK')}</strong></span>
                </div>
              `;
            }
            
            // If no individual taxes but totalTaxAmount exists, show it
            const totalTax = parseFloat(totalTaxAmount || 0);
            if (totalTax > 0) {
              return `
                <div class="total-row">
                  <span class="total-label">Total Tax:</span>
                  <span class="total-amount">${formatCurrency(totalTax, tenantSettings?.currencyCode || 'MWK')}</span>
                </div>
              `;
            }
            
            // No taxes
            return '';
          })()}
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
          ${sale.posAmountTendered != null ? `
            <div style="margin-top: 6px; font-size: 9px; border-top: 1px dashed #ccc; padding-top: 4px;">
              <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                <span>Amount tendered:</span>
                <span>${formatCurrency(sale.posAmountTendered, tenantSettings?.currencyCode || 'MWK')}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 2px; font-weight: bold;">
                <span>Change:</span>
                <span>${formatCurrency(sale.posChangeGiven != null ? sale.posChangeGiven : 0, tenantSettings?.currencyCode || 'MWK')}</span>
              </div>
            </div>
          ` : ''}
          ${sale.notes ? `<div style="margin-top: 4px; font-size: 8px;">Notes: ${sale.notes}</div>` : ''}
        </div>
        
        <!-- ENHANCED: Footer with customizable business message, phone and bank details -->
        <div class="footer">
          ${tenantSettings?.receiptFooter ? `
          <div class="custom-footer">${tenantSettings.receiptFooter}</div>
          ` : `
          <div class="custom-footer">Thank you for your business!</div>
          `}
          ${(sale.footerPhoneOverride != null && sale.footerPhoneOverride !== '') ? `
          <div class="business-info" style="margin-top: 4px;">Tel: ${sale.footerPhoneOverride}</div>
          ` : tenantSettings?.businessPhone ? `
          <div class="business-info" style="margin-top: 4px;">Tel: ${tenantSettings.businessPhone}</div>
          ` : ''}
          ${(sale.footerBankDetailsOverride != null && sale.footerBankDetailsOverride !== '') ? `
          <div class="business-info" style="margin-top: 4px; white-space: pre-wrap;">${sale.footerBankDetailsOverride}</div>
          ` : tenantSettings?.defaultBankDetails ? `
          <div class="business-info" style="margin-top: 4px; white-space: pre-wrap;">${tenantSettings.defaultBankDetails}</div>
          ` : ''}
          <div class="copyright">${new Date().getFullYear()} © ${sale.tenant.name} | insightbooksafrica.com</div>
        </div>
      </div>
      
      <script>
        (function () {
          function clampDocumentHeightToContent() {
            var el = document.documentElement;
            var b = document.body;
            var receipt = document.querySelector('.receipt');
            var h;
            if (receipt) {
              // Use receipt box only — body scrollHeight often includes collapsed margins / extra slack
              h = receipt.offsetTop + receipt.offsetHeight;
            } else {
              h = Math.max(
                b.scrollHeight,
                b.offsetHeight,
                el.scrollHeight,
                el.offsetHeight
              );
            }
            h = Math.ceil(h);
            if (h > 0) {
              el.style.height = h + 'px';
              b.style.height = h + 'px';
              el.style.minHeight = '0';
              b.style.minHeight = '0';
            }
            el.style.overflow = 'hidden';
            b.style.overflow = 'hidden';
          }
          function whenImagesReady(cb) {
            var imgs = document.images;
            var n = 0;
            for (var i = 0; i < imgs.length; i++) {
              if (!imgs[i].complete) n++;
            }
            if (n === 0) return cb();
            var done = 0;
            function one() {
              done++;
              if (done >= n) cb();
            }
            for (var j = 0; j < imgs.length; j++) {
              if (!imgs[j].complete) {
                imgs[j].onload = imgs[j].onerror = one;
              }
            }
          }
          function runPrint() {
            clampDocumentHeightToContent();
            requestAnimationFrame(function () {
              clampDocumentHeightToContent();
              requestAnimationFrame(function () {
                clampDocumentHeightToContent();
                try {
                  window.print();
                } catch (e) {}
              });
            });
          }
          window.addEventListener('beforeprint', function () {
            clampDocumentHeightToContent();
          });
          window.onload = function () {
            var start = function () {
              whenImagesReady(function () {
                clampDocumentHeightToContent();
                setTimeout(function () {
                  runPrint();
                }, 150);
              });
            };
            if (document.fonts && document.fonts.ready) {
              document.fonts.ready.then(start).catch(start);
            } else {
              setTimeout(start, 0);
            }
          };
          window.onafterprint = function () {
            setTimeout(function () {
              try { window.close(); } catch (e) {}
            }, 800);
          };
        })();
      </script>
    </body>
    </html>
    `;
    
    // Log the receipt generation in the audit log (non-blocking; don't fail receipt on audit error)
    try {
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
    } catch (auditErr) {
      console.warn('Receipt audit log failed (receipt still returned):', auditErr?.message || auditErr);
    }

    const format = new URL(request.url).searchParams.get('format');
    if (format === 'pdf') {
      let buffer;
      try {
        const { receiptHtmlToPdf } = await import('@/lib/receiptPdf');
        buffer = await receiptHtmlToPdf(receiptHtml);
      } catch (pdfErr) {
        const pdfMsg = pdfErr?.message || String(pdfErr);
        console.error('Receipt PDF (puppeteer) failed, falling back to text PDF:', pdfMsg);
        if (pdfErr?.stack) console.error(pdfErr.stack);

        const lines = [];
        lines.push(`${sale.tenant?.name || 'Receipt'}`);
        lines.push(`Receipt #${sale.saleNumber || saleId}`);
        lines.push(`Date: ${formatDateDDMMYYYY(sale.saleDate)} ${formatTime(sale.saleDate)}`);
        lines.push(`Customer: ${sale.client ? sale.client.name : 'Walk-in Customer'}`);
        lines.push(`Cashier: ${sale.createdBy?.name || ''}`);
        lines.push('');
        lines.push('Items:');
        for (const item of sale.items || []) {
          const qty = Number(item.quantity || 1);
          const unit = Number(item.unitPrice || 0);
          const desc = (item.description || '').toString();
          lines.push(`- ${desc}  (${qty} x ${unit})`);
        }
        lines.push('');
        lines.push(`Subtotal: ${sale.subtotal}`);
        lines.push(`Tax: ${sale.totalTaxAmount}`);
        lines.push(`Discount: ${sale.totalDiscountAmount}`);
        lines.push(`TOTAL: ${sale.total}`);
        if (sale.posAmountTendered != null) {
          lines.push(`Amount tendered: ${sale.posAmountTendered}`);
          lines.push(`Change: ${sale.posChangeGiven != null ? sale.posChangeGiven : 0}`);
        }
        lines.push('');
        lines.push('This PDF is a fallback (reduced formatting).');
        lines.push(`PDF error: ${pdfMsg}`);
        buffer = textToMinimalPdf(lines.join('\n'));
      }
      const safeSale = (sale.saleNumber || saleId || 'receipt')
        .toString()
        .replace(/[^\w.-]+/g, '_');
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="receipt-${safeSale}.pdf"`,
        },
      });
    }

    // Return HTML response (print view)
    return new NextResponse(receiptHtml, {
      headers: {
        'Content-Type': 'text/html',
      }
    });
  } catch (error) {
    const errMsg = error?.message || String(error);
    console.error(`Error generating receipt for sale ${saleId}:`, errMsg);
    if (error?.stack) console.error(error.stack);
    return NextResponse.json(
      {
        error: 'Failed to generate receipt. Please try again.',
        ...(process.env.NODE_ENV === 'development' && { details: errMsg })
      },
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