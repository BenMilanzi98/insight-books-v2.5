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

    const format = new URL(request.url).searchParams.get('format');
    if (format === 'print-data') {
      const { buildPosReceiptEscPosContents } = await import(
        '@/lib/buildPosReceiptEscPosContents'
      );
      return NextResponse.json(
        buildPosReceiptEscPosContents({ sale, tenantSettings, taxData })
      );
    }

    // Create the HTML receipt — 80 mm thermal roll, styled to match branded receipt template
    const cur = tenantSettings?.currencyCode || 'MWK';
    const receiptHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=302,initial-scale=1,maximum-scale=1">
<title>Receipt - ${sale.saleNumber}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{background:#94a3b8;height:auto}
/*
 * 80 mm roll → ~72 mm printable → ~272 px at 96 dpi
 * Font A (normal body) ≈ 12 pt = 11 px; Font B (compact) ≈ 9 pt = 8 px
 * Header (store name) ≈ double-height = 16 px; Total line ≈ 14 px bold
 */
body{
  font-family:Arial,Helvetica,sans-serif;
  margin:0 auto;
  font-size:11px;       /* Font A — normal body */
  line-height:1.5;
  color:#1a1a1a;
  background:transparent;
  width:100%;
  max-width:80mm;
}
.paper{background:#fff;width:100%}
/* 3 mm side margins each side leaves ~66 mm usable */
.body{padding:6px 6px 10px}
/* ── Company header (double-size branding) ─────────────── */
.co-header{text-align:center;margin-bottom:4px}
.co-logo{max-width:56px;max-height:56px;display:block;margin:0 auto 4px;object-fit:contain}
.co-name{font-size:16px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;line-height:1.2}
/* ── RECEIPT title (largest element) ──────────────────── */
.rtitle{text-align:center;font-size:18px;font-weight:bold;letter-spacing:4px;margin:7px 0 6px;line-height:1}
/* ── Dashed section separator ──────────────────────────── */
.sep{border:none;border-top:1px dashed #555;margin:6px 0}
/* ── Info field rows: LABEL   value  (Font A, 11 px) ───── */
.frow{display:flex;align-items:baseline;gap:4px;margin:2px 0}
.flabel{font-weight:bold;font-size:11px;white-space:nowrap;flex-shrink:0;min-width:80px}
.fval{flex:1;font-size:11px;text-align:right;word-break:break-word}
/* ── Items table (Font B — compact, ~9 px) ─────────────── */
.itbl{width:100%;border-collapse:collapse;font-size:9px;margin:3px 0}
.itbl th{font-weight:bold;padding:2px 2px;text-align:left;border-bottom:1px solid #222;font-size:9px}
.itbl th.r{text-align:right}
.itbl td{padding:3px 2px;vertical-align:top;font-size:9px}
.itbl td.c{text-align:center;width:10%}
.itbl td.d{width:58%}
.itbl td.r{text-align:right;width:32%}
.itbl tr.ir td{border-bottom:1px dotted #ccc}
/* Sub-lines (unit price, tax, discount) — smallest readable size */
.isub{font-size:8px;color:#555;margin-top:1px;line-height:1.3}
/* ── Totals (Font A, 11 px; grand total 14 px bold) ────── */
.trow{display:flex;align-items:baseline;gap:4px;margin:3px 0}
.tlabel{font-weight:bold;font-size:11px;white-space:nowrap;flex-shrink:0;min-width:95px}
.tval{flex:1;font-size:11px;text-align:right}
/* Grand total — double-height equivalent (14 px bold) */
.trow.grand .tlabel{font-size:14px;font-weight:bold}
.trow.grand .tval{font-size:14px;font-weight:bold}
/* ── Footer ─────────────────────────────────────────────── */
.ty{text-align:center;font-weight:bold;font-size:12px;letter-spacing:1px;margin:8px 0 4px;line-height:1.3}
.credit{text-align:center;font-size:9px;color:#555;margin-bottom:1px}
@media print{
  html{background:#fff!important}
  body{width:80mm;max-width:80mm;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{margin:0;size:80mm auto}
}
</style>
</head>
<body>
<div class="paper">
<div class="body">

  <!-- Company header: logo takes priority; fall back to business name text -->
  <div class="co-header">
    ${sale.tenant.logoUrl
      ? `<img src="${sale.tenant.logoUrl.startsWith('http') ? sale.tenant.logoUrl : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${sale.tenant.logoUrl}`}" alt="${sale.tenant.name}" class="co-logo">`
      : `<div class="co-name">${sale.tenant.name}</div>`}
  </div>

  <div class="rtitle">RECEIPT</div>

  <!-- Meta fields -->
  ${(tenantSettings?.buildingName || tenantSettings?.businessAddress) ? `<div class="frow"><span class="flabel">ADDRESS:</span><span class="fval">${[tenantSettings?.buildingName, tenantSettings?.businessAddress, tenantSettings?.businessCity].filter(Boolean).join(', ')}</span></div>` : ''}
  ${tenantSettings?.businessPhone ? `<div class="frow"><span class="flabel">Tel.</span><span class="fval">${tenantSettings.businessPhone}</span></div>` : ''}
  <div class="frow"><span class="flabel">DATE</span><span class="fval">${sale.isHistorical && sale.historicalDate ? formatDateDDMMYYYY(sale.historicalDate) + ' ' + formatTime(sale.historicalDate) + ' (historical)' : formatDateDDMMYYYY(sale.saleDate) + ' ' + formatTime(sale.saleDate)}</span></div>
  <div class="frow"><span class="flabel">TAX INVOICE:</span><span class="fval">${sale.saleNumber}</span></div>
  <div class="frow"><span class="flabel">CUSTOMER:</span><span class="fval">${sale.client ? sale.client.name : 'Walk-in Customer'}</span></div>
  ${sale.client?.phone ? `<div class="frow"><span class="flabel">CUST. TEL:</span><span class="fval">${sale.client.phone}</span></div>` : ''}
  <div class="frow"><span class="flabel">CASHIER:</span><span class="fval">${sale.createdBy.name}</span></div>

  <hr class="sep">

  <!-- Items table -->
  <table class="itbl">
    <thead><tr><th>QTY</th><th>DESC</th><th class="r">PRICE</th></tr></thead>
    <tbody>
      ${sale.items.map(item => {
        const qty = parseFloat(item.quantity || 1);
        const unitPrice = parseFloat(item.unitPrice || 0);
        const discAmt = parseFloat(item.discountAmount || 0);
        const subtotal = (qty * unitPrice) - discAmt;
        const itemTaxes = item.itemTaxes || [];
        let itemTaxTotal = 0;
        itemTaxes.forEach(t => { itemTaxTotal += parseFloat(t.taxAmount || 0); });
        if (itemTaxTotal === 0 && item.taxAmount) itemTaxTotal = parseFloat(item.taxAmount || 0);
        const itemTotal = subtotal + itemTaxTotal;
        const qtyStr = qty % 1 === 0 ? qty.toFixed(0) : qty.toString();
        const taxSubLines = itemTaxes.length > 0
          ? itemTaxes.map(t => `<div class="isub">${t.taxName || 'Tax'}${t.taxCode ? ' (' + t.taxCode + ')' : ''}: ${formatCurrency(parseFloat(t.taxAmount || 0), cur)}</div>`).join('')
          : (itemTaxTotal > 0 ? `<div class="isub">Tax: ${formatCurrency(itemTaxTotal, cur)}</div>` : '');
        return `<tr class="ir">
          <td class="c">${qtyStr}</td>
          <td class="d">${item.description}
            <div class="isub">${qtyStr} x ${formatCurrency(unitPrice, cur)}</div>
            ${discAmt > 0 ? `<div class="isub">Disc: -${formatCurrency(discAmt, cur)}</div>` : ''}
            ${taxSubLines}
          </td>
          <td class="r">${formatCurrency(itemTotal, cur)}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>

  <hr class="sep">

  <!-- Totals -->
  ${(sale.totalDiscountAmount > 0 || taxData.hasAnyTaxes || parseFloat(taxData.totalTaxAmount || 0) > 0) ? `
  <div class="trow"><span class="tlabel">SUBTOTAL:</span><span class="tval">${formatCurrency(sale.subtotal, cur)}</span></div>` : ''}
  ${sale.totalDiscountAmount > 0 ? `
  <div class="trow"><span class="tlabel">DISCOUNT:</span><span class="tval">-${formatCurrency(sale.totalDiscountAmount, cur)}</span></div>` : ''}
  ${taxData.hasAnyTaxes && taxData.taxGroups.length > 0
    ? taxData.taxGroups.map(tax => `<div class="trow"><span class="tlabel">${tax.taxName}${tax.taxCode ? ' (' + tax.taxCode + ')' : ''}:</span><span class="tval">${formatCurrency(parseFloat(tax.totalAmount || 0), cur)}</span></div>`).join('')
    : (parseFloat(taxData.totalTaxAmount || 0) > 0 ? `<div class="trow"><span class="tlabel">TAX:</span><span class="tval">${formatCurrency(parseFloat(taxData.totalTaxAmount || 0), cur)}</span></div>` : '')}

  <div class="trow grand"><span class="tlabel">TOTAL AMOUNT</span><span class="tval">${formatCurrency(sale.total, cur)}</span></div>

  ${sale.posAmountTendered != null ? `
  <div class="trow"><span class="tlabel">CASH</span><span class="tval">${formatCurrency(sale.posAmountTendered, cur)}</span></div>
  <div class="trow"><span class="tlabel">CHANGE</span><span class="tval">${formatCurrency(sale.posChangeGiven != null ? sale.posChangeGiven : 0, cur)}</span></div>` : ''}

  <hr class="sep">

  <!-- Payment breakdown -->
  ${sale.payments && sale.payments.length > 0 && sale.payments[0].allocations && sale.payments[0].allocations.length > 0
    ? sale.payments[0].allocations.map(alloc => `<div class="frow"><span class="flabel">${alloc.paymentAccount?.name || 'Payment'}:</span><span class="fval">${formatCurrency(parseFloat(alloc.amount || 0), cur)}</span></div>`).join('')
    : `<div class="frow"><span class="flabel">${sale.posAmountTendered != null ? 'Cash' : (sale.paymentMethod || 'Payment')}:</span><span class="fval">${formatCurrency(sale.total, cur)}</span></div>`}
  ${sale.payments && sale.payments.length > 0 && sale.payments[0].reference
    ? `<div class="frow"><span class="flabel">Approval Code:</span><span class="fval">${sale.payments[0].reference}</span></div>`
    : ''}
  ${(sale.footerBankDetailsOverride || tenantSettings?.defaultBankDetails)
    ? `<div class="frow" style="margin-top:3px"><span class="flabel">Bank Details:</span><span class="fval" style="font-size:8px;white-space:pre-wrap">${sale.footerBankDetailsOverride || tenantSettings.defaultBankDetails}</span></div>`
    : ''}
  ${sale.notes ? `<div class="frow"><span class="flabel">Notes:</span><span class="fval" style="font-size:8px">${sale.notes}</span></div>` : ''}

  <hr class="sep">

  <!-- Footer -->
  <div class="ty">${tenantSettings?.receiptFooter || 'THANK YOU FOR YOUR BUSINESS!'}</div>
  <div class="credit">${sale.tenant.name} | insightbooksafrica.com</div>

</div><!-- /body -->
</div><!-- /paper -->

<script>
(function(){
  function clamp(){
    var el=document.documentElement,b=document.body;
    var paper=document.querySelector('.paper');
    var h=paper?(paper.offsetTop+paper.offsetHeight):Math.max(b.scrollHeight,b.offsetHeight,el.scrollHeight,el.offsetHeight);
    h=Math.ceil(h);
    if(h>0){el.style.height=h+'px';b.style.height=h+'px';el.style.minHeight='0';b.style.minHeight='0';}
    el.style.overflow='hidden';b.style.overflow='hidden';
  }
  function whenImgsReady(cb){
    var imgs=document.images,n=0,done=0;
    for(var i=0;i<imgs.length;i++)if(!imgs[i].complete)n++;
    if(n===0)return cb();
    function one(){done++;if(done>=n)cb();}
    for(var j=0;j<imgs.length;j++)if(!imgs[j].complete){imgs[j].onload=imgs[j].onerror=one;}
  }
  function runPrint(){
    clamp();
    requestAnimationFrame(function(){clamp();requestAnimationFrame(function(){clamp();try{window.print();}catch(e){}});});
  }
  window.addEventListener('beforeprint',clamp);
  window.onload=function(){
    var go=function(){whenImgsReady(function(){clamp();setTimeout(runPrint,150);});};
    if(document.fonts&&document.fonts.ready){document.fonts.ready.then(go).catch(go);}else{setTimeout(go,0);}
  };
  var closed=false;
  function tryClose(){if(closed)return;closed=true;setTimeout(function(){try{window.close();}catch(e){}},120);}
  window.addEventListener('afterprint',tryClose);
  try{window.matchMedia('print').addEventListener('change',function(e){if(!e.matches)tryClose();});}
  catch(e1){try{window.matchMedia('print').addListener(function(mql){if(!mql.matches)tryClose();});}catch(e2){}}
})();
</script>
</body>
</html>`;
    
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

    if (format === 'pdf') {
      let buffer;
      try {
        const { generateSaleReceiptPdfBuffer } = await import('@/lib/server-pdf-jspdf');
        buffer = generateSaleReceiptPdfBuffer(sale, tenantSettings, taxData);
      } catch (pdfErr) {
        const pdfMsg = pdfErr?.message || String(pdfErr);
        console.error('Receipt PDF (jsPDF) failed, falling back to text PDF:', pdfMsg);
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