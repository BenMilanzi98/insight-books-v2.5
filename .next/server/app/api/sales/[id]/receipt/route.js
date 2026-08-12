(()=>{var a={};a.id=18401,a.ids=[18401],a.modules={78335:()=>{},92899:(a,b,c)=>{"use strict";function d(a){let b=function(a){let b=String(a??"").replace(/\r\n/g,"\n").replace(/\r/g,"\n"),c=[];for(let a of b.split("\n")){if(a.length<=90){c.push(a);continue}for(let b=0;b<a.length;b+=90)c.push(a.slice(b,b+90))}return c}(a),c=[];c.push("BT"),c.push("/F1 10 Tf"),c.push("50 750 Td");for(let a=0;a<b.length;a++){let d=String(b[a]??"").replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");c.push(`(${d}) Tj`),a<b.length-1&&c.push("0 -14 Td")}c.push("ET");let d=c.join("\n"),e=["%PDF-1.4\n","1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n","2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n","3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n/Resources <<\n/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n>>\nendobj\n",`4 0 obj
<<
/Length ${Buffer.byteLength(d,"utf8")}
>>
stream
${d}
endstream
endobj
`],f=[],g=0;for(let a of e)f.push(g),g+=Buffer.byteLength(a,"utf8");let h=g,i="xref\n0 5\n0000000000 65535 f \n"+f.slice(1).map(a=>String(a).padStart(10,"0")+" 00000 n \n").join(""),j=`trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
${h}
%%EOF`;return Buffer.from(e.join("")+i+j,"utf8")}c.d(b,{g:()=>d})},181280:(a,b,c)=>{"use strict";c.d(b,{F:()=>g,q:()=>f});var d=c(215220),e=c(476706);async function f(a,b=d.default){return a?(0,e.Kh)(a,b):null}async function g(a){if(!a?.tenantId)return a.primaryBranchId=null,a.currentBranchId=null,a.allowedBranchIds=null,a;let b=await f(a.tenantId);return a.primaryBranchId=b,a.currentBranchId=b,a.defaultBranchId=b,a.allowedBranchIds=null,a}},200261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},215220:(a,b,c)=>{"use strict";c.r(b),c.d(b,{default:()=>g,prisma:()=>f});var d=c(896330);let e=global,f=(e.prisma,e.prisma||(e.prisma=new d.PrismaClient({log:["error"]})),e.prisma),g=f},296487:()=>{},305735:(a,b,c)=>{"use strict";a.exports=c(707553).vendored["react-rsc"].ReactJsxRuntime},383501:a=>{"use strict";a.exports=import("jspdf-autotable")},403026:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>J,patchFetch:()=>I,routeModule:()=>E,serverHooks:()=>H,workAsyncStorage:()=>F,workUnitAsyncStorage:()=>G});var d={};c.r(d),c.d(d,{GET:()=>A});var e=c(319225),f=c(684006),g=c(8317),h=c(799373),i=c(434775),j=c(524235),k=c(200261),l=c(754365),m=c(590771),n=c(473461),o=c(767798),p=c(192280),q=c(662018),r=c(445696),s=c(347929),t=c(986439),u=c(137527),v=c(945592),w=c(215220),x=c(701026);c(643362);var y=c(92899),z=c(855312);async function A(a,{params:b}){let d="function"==typeof b.then?await b:b,e=d?.id??null;try{var f,g;let b,d,h,i;if(!e)return v.NextResponse.json({error:"Sale ID required"},{status:400});let j=await (0,x.Ux)(a);if(!j)return v.NextResponse.json({error:"Authentication required"},{status:401});let k=await w.default.sale.findUnique({where:{id:e},include:{client:{select:{id:!0,name:!0,email:!0,phone:!0,address:!0}},createdBy:{select:{id:!0,name:!0}},tenant:{select:{id:!0,name:!0,logoUrl:!0}},items:{include:{product:{select:{id:!0,name:!0,sku:!0}}},orderBy:{id:"asc"}},payments:{include:{allocations:{include:{paymentAccount:{select:{id:!0,name:!0,accountType:!0}}}}},orderBy:{createdAt:"desc"},take:1}}});if(!k)return v.NextResponse.json({error:"Sale not found"},{status:404});if(k.tenantId!==j.tenantId)return v.NextResponse.json({error:"Access denied"},{status:403});let l=null;try{l=await w.default.tenantSettings.findUnique({where:{tenantId:k.tenantId}})??null}catch(a){console.warn("Receipt: could not load tenant settings:",a?.message||a)}let m={},n=Array.isArray(k.items)?k.items.map(a=>a.id):[];try{if(0===n.length)k.items=(k.items||[]).map(a=>({...a,itemTaxes:[],amount:"object"==typeof a.amount&&a.amount?.toNumber?a.amount.toNumber():parseFloat(a.amount||0),taxAmount:"object"==typeof a.taxAmount&&a.taxAmount?.toNumber?a.taxAmount.toNumber():parseFloat(a.taxAmount||0)}));else{let a=await w.default.saleItemTax.findMany({where:{saleItemId:{in:n}},select:{id:!0,saleItemId:!0,taxName:!0,taxCode:!0,taxRate:!0,taxAmount:!0}});a.forEach(a=>{m[a.saleItemId]||(m[a.saleItemId]=[]),m[a.saleItemId].push(a)}),k.items=k.items.map(a=>{let b=(m[a.id]||[]).map(a=>({id:a.id,saleItemId:a.saleItemId,taxName:a.taxName||null,taxCode:a.taxCode||null,taxRate:"object"==typeof a.taxRate&&a.taxRate?.toNumber?a.taxRate.toNumber():parseFloat(a.taxRate||0),taxAmount:"object"==typeof a.taxAmount&&a.taxAmount?.toNumber?a.taxAmount.toNumber():parseFloat(a.taxAmount||0)}));return{...a,itemTaxes:b,amount:"object"==typeof a.amount&&a.amount?.toNumber?a.amount.toNumber():parseFloat(a.amount||0),taxAmount:"object"==typeof a.taxAmount&&a.taxAmount?.toNumber?a.taxAmount.toNumber():parseFloat(a.taxAmount||0)}}),console.log("Receipt API - Item taxes fetched:",a.length),console.log("Receipt API - Items with taxes:",k.items.map(a=>({id:a.id,description:a.description,taxCount:a.itemTaxes?.length||0,taxes:a.itemTaxes})))}}catch(a){a.message?.includes("does not exist")||a.message?.includes("Unknown model")||console.error("Error fetching item taxes:",a)}k.totalTaxAmount="object"==typeof k.totalTaxAmount&&k.totalTaxAmount?.toNumber?k.totalTaxAmount.toNumber():parseFloat(k.totalTaxAmount||0),k.subtotal="object"==typeof k.subtotal&&k.subtotal?.toNumber?k.subtotal.toNumber():parseFloat(k.subtotal||0),k.total="object"==typeof k.total&&k.total?.toNumber?k.total.toNumber():parseFloat(k.total||0),k.totalDiscountAmount="object"==typeof k.totalDiscountAmount&&k.totalDiscountAmount?.toNumber?k.totalDiscountAmount.toNumber():parseFloat(k.totalDiscountAmount||0),k.posAmountTendered=null!=k.posAmountTendered&&""!==k.posAmountTendered?"object"==typeof k.posAmountTendered&&k.posAmountTendered?.toNumber?k.posAmountTendered.toNumber():parseFloat(k.posAmountTendered):null,k.posChangeGiven=null!=k.posChangeGiven&&""!==k.posChangeGiven?"object"==typeof k.posChangeGiven&&k.posChangeGiven?.toNumber?k.posChangeGiven.toNumber():parseFloat(k.posChangeGiven):null,null!=k.posAmountTendered&&Number.isNaN(k.posAmountTendered)&&(k.posAmountTendered=null),null!=k.posChangeGiven&&Number.isNaN(k.posChangeGiven)&&(k.posChangeGiven=null),console.log("Receipt API - Logo URL:",k.tenant.logoUrl),console.log("Receipt API - Tenant name:",k.tenant.name),console.log("Receipt API - Total Tax Amount:",k.totalTaxAmount),console.log("Receipt API - Sale Items Count:",k.items.length),console.log("Receipt API - Items with taxes:",JSON.stringify(k.items.map(a=>({id:a.id,description:a.description,taxCount:a.itemTaxes?.length||0,taxes:a.itemTaxes?.map(a=>({name:a.taxName,amount:a.taxAmount}))||[]})),null,2));let o=(f=k.items,g=k.totalTaxAmount,b={},d=!1,h=0,(Array.isArray(f)?f:[]).forEach((a,c)=>{let e=a.itemTaxes||[],f=parseFloat(a.quantity||1);if(parseFloat(a.unitPrice||0),e.length>0)d=!0,e.forEach(d=>{let e=(d.taxName||d.taxId||"Tax").trim(),g=parseFloat(d.taxAmount||0);b[e]||(b[e]={taxName:d.taxName||d.taxId||"Tax",taxCode:d.taxCode||null,totalAmount:0}),b[e].totalAmount+=g,h+=g,console.log(`Receipt Tax Processing - Item ${c+1}: ${a.description}, Qty: ${f}, Tax: ${d.taxName}, Amount: ${g}, Running Total: ${b[e].totalAmount}`)});else if(a.taxAmount&&parseFloat(a.taxAmount)>0){d=!0;let c=a.taxDescription||"Tax",e=parseFloat(a.taxAmount||0);b[c]||(b[c]={taxName:a.taxDescription||"Tax",taxCode:null,totalAmount:0}),b[c].totalAmount+=e,h+=e}}),i=Object.values(b).sort((a,b)=>(a.taxName||"").localeCompare(b.taxName||"")),console.log("Receipt Tax Summary:",{totalTaxFromItems:h,saleTotalTaxAmount:g,taxGroups:i.map(a=>({name:a.taxName,amount:a.totalAmount}))}),{taxGroups:i,hasAnyTaxes:d,totalTaxFromItems:h,totalTaxAmount:h>0?h:parseFloat(g||0)});console.log("Receipt API - Processed tax data:",JSON.stringify(o,null,2));let p=new URL(a.url),q=p.searchParams.get("format"),r=(0,z.gn)(p.searchParams.get("paperWidth")??p.searchParams.get("paperWidthMm")??l?.receiptPaperWidthMm),s=(0,z.JZ)(r),t=r<=58,u=(0,z.PK)(r),A=p.searchParams.get("autoPrint"),E="0"===A||"false"===A||"off"===A;if("print-data"===q){let{buildPosReceiptEscPosContents:a}=await c.e(58931).then(c.bind(c,758931));return v.NextResponse.json(a({sale:k,tenantSettings:{...l||{},receiptPaperWidthMm:r},taxData:o,paperWidth:r}))}let F=l?.currencyCode||"MWK",G=`<script>
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
  window.addEventListener('beforeprint',clamp);
  window.onload=function(){
    var go=function(){whenImgsReady(function(){
      clamp();setTimeout(clamp,150);setTimeout(clamp,400);
    });};
    if(document.fonts&&document.fonts.ready){document.fonts.ready.then(go).catch(go);}else{setTimeout(go,0);}
  };
})();
</script>`,H=`<!DOCTYPE html>
<html lang="en"${E?' class="receipt-embed"':""}>
    <head>
      <meta charset="utf-8">
<meta name="viewport" content="width=${u},initial-scale=1,maximum-scale=1">
      <title>Receipt - ${k.saleNumber}</title>
      <style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{background:#94a3b8;height:auto}
html.receipt-embed,html.receipt-embed body{min-height:0!important;max-height:none}
/*
 * Thermal roll ${r} mm → ~${u} px at 96 dpi.
 * Type scales for narrower rolls so labels still fit.
 */
body{
  font-family:Arial,Helvetica,sans-serif;
  margin:0 auto;
  font-size:${s.bodyPx}px;
  font-weight:bold;
  line-height:1.5;
  color:#1a1a1a;
  background:transparent;
  width:100%;
  max-width:${r}mm;
}
.paper{background:#fff;width:100%}
.body{padding:${t?"4px 4px 8px":"6px 6px 10px"}}
.co-header{text-align:center;margin-bottom:4px}
.co-logo{max-width:${s.logoPx}px;max-height:${s.logoPx}px;display:block;margin:0 auto 4px;object-fit:contain}
.co-name{font-size:${s.headerPx}px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;line-height:1.2}
.rtitle{text-align:center;font-size:${s.bodyPx}px;font-weight:bold;letter-spacing:${t?2:4}px;margin:7px 0 6px;line-height:1}
.sep{border:none;border-top:1px dashed #555;margin:6px 0}
.frow{display:flex;align-items:baseline;gap:4px;margin:2px 0}
.flabel{font-weight:bold;font-size:${s.bodyPx}px;white-space:nowrap;flex-shrink:0;min-width:${s.labelMinPx}px}
.fval{flex:1;font-size:${s.bodyPx}px;text-align:right;word-break:break-word;font-weight:bold}
.itbl{width:100%;border-collapse:collapse;font-size:${s.bodyPx}px;margin:3px 0;table-layout:fixed}
.itbl th{font-weight:bold;padding:2px 2px;text-align:left;border-bottom:1px solid #222;font-size:${s.bodyPx}px}
.itbl th.r{text-align:right}
.itbl td{padding:${t?2:3}px 2px;vertical-align:top;font-size:${s.bodyPx}px;overflow-wrap:anywhere}
.itbl td.c{text-align:center;width:${t?14:10}%}
.itbl td.d{width:${t?52:58}%}
.itbl td.r{text-align:right;width:${t?34:32}%}
.itbl tr.ir td{border-bottom:1px dotted #ccc}
.isub{font-size:${t?9:s.bodyPx}px;margin-top:1px;line-height:1.3;display:flex;justify-content:space-between;gap:4px}
.trow{display:flex;align-items:baseline;gap:4px;margin:3px 0}
.tlabel{font-weight:bold;font-size:${s.bodyPx}px;white-space:nowrap;flex-shrink:0;min-width:${s.totalLabelMinPx}px}
.tval{flex:1;font-size:${s.bodyPx}px;text-align:right;font-weight:bold}
.trow.grand .tlabel{font-size:${s.grandPx}px;font-weight:bold}
.trow.grand .tval{font-size:${s.grandPx}px;font-weight:bold}
.ty{text-align:center;font-weight:bold;font-size:${s.bodyPx}px;letter-spacing:1px;margin:8px 0 4px;line-height:1.3}
.credit{text-align:center;font-size:${s.bodyPx}px;font-weight:bold;margin-bottom:1px}
@media print{
  html{background:#fff!important}
  body{width:${r}mm;max-width:${r}mm;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{margin:0;size:${r}mm auto}
        }
      </style>
    </head>
    <body>
<div class="paper">
<div class="body">

  <!-- Company header: logo takes priority; fall back to business name text -->
  <div class="co-header">
    ${k.tenant.logoUrl?`<img src="${k.tenant.logoUrl.startsWith("http")?k.tenant.logoUrl:`http://213.165.230.139:3000${k.tenant.logoUrl}`}" alt="${k.tenant.name}" class="co-logo">`:`<div class="co-name">${k.tenant.name}</div>`}
        </div>
        
  <div class="rtitle">RECEIPT</div>

  <!-- Meta fields -->
  ${l?.buildingName||l?.businessAddress?`<div class="frow"><span class="flabel">ADDRESS:</span><span class="fval">${[l?.buildingName,l?.businessAddress,l?.businessCity].filter(Boolean).join(", ")}</span></div>`:""}
  ${l?.businessPhone?`<div class="frow"><span class="flabel">Tel.</span><span class="fval">${l.businessPhone}</span></div>`:""}
  <div class="frow"><span class="flabel">DATE</span><span class="fval">${k.isHistorical&&k.historicalDate?C(k.historicalDate)+" "+D(k.historicalDate)+" (historical)":C(k.saleDate)+" "+D(k.saleDate)}</span></div>
  <div class="frow"><span class="flabel">TAX INVOICE:</span><span class="fval">${k.saleNumber}</span></div>
  <div class="frow"><span class="flabel">CUSTOMER:</span><span class="fval">${k.client?k.client.name:"Walk-in Customer"}</span></div>
  ${k.client?.phone?`<div class="frow"><span class="flabel">CUST. TEL:</span><span class="fval">${k.client.phone}</span></div>`:""}
  <div class="frow"><span class="flabel">CASHIER:</span><span class="fval">${k.createdBy.name}</span></div>

  <hr class="sep">

  <!-- Items table -->
  <table class="itbl">
    <thead><tr><th>QTY</th><th>DESC</th><th class="r">PRICE</th></tr></thead>
    <tbody>
        ${k.items.map(a=>{let b=parseFloat(a.quantity||1),c=parseFloat(a.unitPrice||0),d=parseFloat(a.discountAmount||0),e=b*c-d,f=b>0?Math.max(0,e/b):c,g=a.itemTaxes||[],h=0;g.forEach(a=>{h+=parseFloat(a.taxAmount||0)}),0===h&&a.taxAmount&&(h=parseFloat(a.taxAmount||0));let i=e+h,j=b%1==0?b.toFixed(0):b.toString(),k=g.length>0?g.map(a=>`<div class="isub"><span>${a.taxName||"Tax"}${a.taxCode?" ("+a.taxCode+")":""}:</span><span>${B(parseFloat(a.taxAmount||0),F)}</span></div>`).join(""):h>0?`<div class="isub"><span>Tax:</span><span>${B(h,F)}</span></div>`:"";return`<tr class="ir">
          <td class="c">${j}</td>
          <td class="d">${a.description}
            <div class="isub"><span>${j} x ${B(f,F)}</span><span>${B(e,F)}</span></div>
            ${d>0?`<div class="isub"><span>Disc:</span><span>-${B(d,F)}</span></div>`:""}
            ${k}
          </td>
          <td class="r">${B(i,F)}</td>
        </tr>`}).join("")}
    </tbody>
  </table>

  <hr class="sep">

  <!-- Totals -->
  ${k.totalDiscountAmount>0||o.hasAnyTaxes||parseFloat(o.totalTaxAmount||0)>0?`
  <div class="trow"><span class="tlabel">SUBTOTAL:</span><span class="tval">${B(k.subtotal,F)}</span></div>`:""}
  ${k.totalDiscountAmount>0?`
  <div class="trow"><span class="tlabel">DISCOUNT:</span><span class="tval">-${B(k.totalDiscountAmount,F)}</span></div>`:""}
  ${o.hasAnyTaxes&&o.taxGroups.length>0?o.taxGroups.map(a=>`<div class="trow"><span class="tlabel">${a.taxName}${a.taxCode?" ("+a.taxCode+")":""}:</span><span class="tval">${B(parseFloat(a.totalAmount||0),F)}</span></div>`).join(""):parseFloat(o.totalTaxAmount||0)>0?`<div class="trow"><span class="tlabel">TAX:</span><span class="tval">${B(parseFloat(o.totalTaxAmount||0),F)}</span></div>`:""}

  <div class="trow grand"><span class="tlabel">TOTAL AMOUNT</span><span class="tval">${B(k.total,F)}</span></div>

  ${null!=k.posAmountTendered?`
  <div class="trow"><span class="tlabel">CASH</span><span class="tval">${B(k.posAmountTendered,F)}</span></div>
  <div class="trow"><span class="tlabel">CHANGE</span><span class="tval">${B(null!=k.posChangeGiven?k.posChangeGiven:0,F)}</span></div>`:""}

  <hr class="sep">

  <!-- Payment breakdown -->
  ${k.payments&&k.payments.length>0&&k.payments[0].allocations&&k.payments[0].allocations.length>0?k.payments[0].allocations.map(a=>`<div class="frow"><span class="flabel">${a.paymentAccount?.name||"Payment"}:</span><span class="fval">${B(parseFloat(a.amount||0),F)}</span></div>`).join(""):`<div class="frow"><span class="flabel">${null!=k.posAmountTendered?"Cash":k.paymentMethod||"Payment"}:</span><span class="fval">${B(k.total,F)}</span></div>`}
  ${k.payments&&k.payments.length>0&&k.payments[0].reference?`<div class="frow"><span class="flabel">Approval Code:</span><span class="fval">${k.payments[0].reference}</span></div>`:""}
  ${k.footerBankDetailsOverride||l?.defaultBankDetails?`<div class="frow" style="margin-top:3px"><span class="flabel">Bank Details:</span><span class="fval" style="font-size:12px;white-space:pre-wrap">${k.footerBankDetailsOverride||l.defaultBankDetails}</span></div>`:""}
  ${k.notes?`<div class="frow"><span class="flabel">Notes:</span><span class="fval" style="font-size:12px">${k.notes}</span></div>`:""}

  <hr class="sep">

  <!-- Footer -->
  <div class="ty">${l?.receiptFooter||"THANK YOU FOR YOUR BUSINESS!"}</div>
  <div class="credit">${k.tenant.name} | insightbooksafrica.com</div>

</div><!-- /body -->
</div><!-- /paper -->

${E?G:`<script>
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
</script>`}
    </body>
</html>`;try{await w.default.auditLog.create({data:{action:"RECEIPT_GENERATED",entityType:"SALE",entityId:k.id,userId:j.id,tenantId:j.tenantId,details:JSON.stringify({saleNumber:k.saleNumber,total:k.total,receiptFormat:"thermal_enhanced"})}})}catch(a){console.warn("Receipt audit log failed (receipt still returned):",a?.message||a)}if("pdf"===q){let a,b=(k.saleNumber||e||"receipt").toString().replace(/[^\w.-]+/g,"_"),d="none";try{if(80!==r)throw Error("Use HTML renderer for compact thermal receipt PDF");let{generateSaleReceiptPdfBuffer:b}=await c.e(68962).then(c.bind(c,668962));a=b(k,l,o),d="jspdf",console.log(`[ReceiptPDF] Generated via jsPDF (${a.length} bytes)`)}catch(b){console.error("[ReceiptPDF] jsPDF failed:",b?.message),console.error("[ReceiptPDF] jsPDF stack:",b?.stack);try{let{launchPuppeteer:b,PDF_SET_CONTENT_OPTIONS:e}=await c.e(92678).then(c.bind(c,392678)),f=H.replace(/<script[\s\S]*?<\/script>/gi,""),g=await b(),h=await g.newPage();await h.setContent(f,e),await h.evaluate(()=>{let a=Array.from(document.images);return Promise.all(a.filter(a=>!a.complete).map(a=>new Promise(b=>{a.onload=a.onerror=b})))});let i=await h.evaluate(()=>{let a=document.querySelector(".paper");return a?a.scrollHeight:document.body.scrollHeight});a=await h.pdf({width:`${r}mm`,height:`${Math.ceil(.2646*i)+10}mm`,printBackground:!0,margin:{top:"2mm",right:"0mm",bottom:"2mm",left:"0mm"}}),await g.close(),d="puppeteer",console.log(`[ReceiptPDF] Generated via Puppeteer (${a.length} bytes)`)}catch(f){console.error("[ReceiptPDF] Puppeteer also failed:",f?.message);let c=[];for(let a of(c.push(k.tenant?.name||"Receipt"),c.push(`Receipt #${k.saleNumber||e}`),c.push(`Date: ${C(k.saleDate)} ${D(k.saleDate)}`),c.push(`Customer: ${k.client?k.client.name:"Walk-in Customer"}`),c.push(`Cashier: ${k.createdBy?.name||""}`),c.push(""),c.push("Items:"),k.items||[])){let b=Number(a.quantity||1),d=b*Number(a.unitPrice||0),e=Number(a.discountAmount||0),f=Math.max(0,d-e),g=b>0?f/b:Number(a.unitPrice||0);c.push(`- ${a.description||""}  (${b} x ${g}) = ${f}`)}c.push(""),c.push(`Subtotal: ${k.subtotal}`),c.push(`Tax: ${k.totalTaxAmount}`),c.push(`Discount: ${k.totalDiscountAmount}`),c.push(`TOTAL: ${k.total}`),null!=k.posAmountTendered&&(c.push(`Amount tendered: ${k.posAmountTendered}`),c.push(`Change: ${null!=k.posChangeGiven?k.posChangeGiven:0}`)),c.push(""),c.push(`[Fallback PDF — jsPDF error: ${b?.message}]`),a=(0,y.g)(c.join("\n")),d="text-fallback",console.error(`[ReceiptPDF] Using text fallback. jsPDF: ${b?.message}. Puppeteer: ${f?.message}`)}}return new v.NextResponse(a,{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="receipt-${b}.pdf"`,"X-PDF-Strategy":d}})}return new v.NextResponse(H,{headers:{"Content-Type":"text/html"}})}catch(a){return console.error(`Error generating receipt for sale ${e}:`,a?.message||String(a)),a?.stack&&console.error(a.stack),v.NextResponse.json({error:"Failed to generate receipt. Please try again.",...!1},{status:500})}}function B(a,b="MWK"){try{return new Intl.NumberFormat("en-US",{style:"currency",currency:b,minimumFractionDigits:2}).format(a)}catch(c){return`${b} ${Number(a).toFixed(2)}`}}function C(a){try{let b=new Date(a),c=String(b.getDate()).padStart(2,"0"),d=String(b.getMonth()+1).padStart(2,"0"),e=b.getFullYear();return`${c}/${d}/${e}`}catch(a){return"Invalid Date"}}function D(a){try{return new Date(a).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",hour12:!1})}catch(a){return"Invalid Time"}}let E=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/sales/[id]/receipt/route",pathname:"/api/sales/[id]/receipt",filename:"route",bundlePath:"app/api/sales/[id]/receipt/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"C:\\laragon\\www\\insight-books-v2.5\\app\\api\\sales\\[id]\\receipt\\route.js",nextConfigOutput:"",userland:d,...{}}),{workAsyncStorage:F,workUnitAsyncStorage:G,serverHooks:H}=E;function I(){return(0,g.patchFetch)({workAsyncStorage:F,workUnitAsyncStorage:G})}async function J(a,b,c){c.requestMeta&&(0,h.setRequestMeta)(a,c.requestMeta),E.isDev&&(0,h.addRequestMeta)(a,"devRequestTimingInternalsEnd",process.hrtime.bigint());let d="/api/sales/[id]/receipt/route";"/index"===d&&(d="/");let e=await E.prepare(a,b,{srcPage:d,multiZoneDraftMode:!1});if(!e)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:g,deploymentId:v,params:w,nextConfig:x,parsedUrl:y,isDraftMode:z,prerenderManifest:A,routerServerContext:B,isOnDemandRevalidate:C,revalidateOnlyGenerated:D,resolvedPathname:F,clientReferenceManifest:G,serverActionsManifest:H}=e,I=(0,k.normalizeAppPath)(d),J=!!(A.dynamicRoutes[I]||A.routes[F]),K=async()=>((null==B?void 0:B.render404)?await B.render404(a,b,y,!1):b.end("This page could not be found"),null);if(J&&!z){let a=!!A.routes[F],b=A.dynamicRoutes[I];if(b&&!1===b.fallback&&!a){if(x.adapterPath)return await K();throw new t.NoFallbackError}}let L=null;!J||E.isDev||z||(L="/index"===(L=F)?"/":L);let M=!0===E.isDev||!J,N=J&&!M;H&&G&&(0,j.setManifestsSingleton)({page:d,clientReferenceManifest:G,serverActionsManifest:H});let O=a.method||"GET",P=(0,i.getTracer)(),Q=P.getActiveScopeSpan(),R=!!(null==B?void 0:B.isWrappedByNextServer),S=!!(0,h.getRequestMeta)(a,"minimalMode"),T=(0,h.getRequestMeta)(a,"incrementalCache")||await E.getIncrementalCache(a,x,A,S);null==T||T.resetRequestCache(),globalThis.__incrementalCache=T;let U={params:w,previewProps:A.preview,renderOpts:{experimental:{authInterrupts:!!x.experimental.authInterrupts},cacheComponents:!!x.cacheComponents,supportsDynamicResponse:M,incrementalCache:T,cacheLifeProfiles:x.cacheLife,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d,e)=>E.onRequestError(a,b,d,e,B)},sharedContext:{buildId:g,deploymentId:v}},V=new l.NodeNextRequest(a),W=new l.NodeNextResponse(b),X=m.NextRequestAdapter.fromNodeNextRequest(V,(0,m.signalFromNodeResponse)(b));try{let e,g=async a=>E.handle(X,U).finally(()=>{if(!a)return;a.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let c=P.getRootSpanAttributes();if(!c)return;if(c.get("next.span_type")!==n.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${c.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let f=c.get("next.route");if(f){let b=`${O} ${f}`;a.setAttributes({"next.route":f,"http.route":f,"next.span_name":b}),a.updateName(b),e&&e!==a&&(e.setAttribute("http.route",f),e.updateName(b))}else a.updateName(`${O} ${d}`)}),h=async e=>{var h,i;let j=async({previousCacheEntry:f})=>{try{if(!S&&C&&D&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let d=await g(e);a.fetchMetrics=U.renderOpts.fetchMetrics;let h=U.renderOpts.pendingWaitUntil;h&&c.waitUntil&&(c.waitUntil(h),h=void 0);let i=U.renderOpts.collectedTags;if(!J)return await (0,p.I)(V,W,d,U.renderOpts.pendingWaitUntil),null;{let a=await d.blob(),b=(0,q.toNodeOutgoingHttpHeaders)(d.headers);i&&(b[s.NEXT_CACHE_TAGS_HEADER]=i),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==U.renderOpts.collectedRevalidate&&!(U.renderOpts.collectedRevalidate>=s.INFINITE_CACHE)&&U.renderOpts.collectedRevalidate,e=void 0===U.renderOpts.collectedExpire||U.renderOpts.collectedExpire>=s.INFINITE_CACHE?void 0:U.renderOpts.collectedExpire;return{value:{kind:u.CachedRouteKind.APP_ROUTE,status:d.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:e}}}}catch(b){throw(null==f?void 0:f.isStale)&&await E.onRequestError(a,b,{routerKind:"App Router",routePath:d,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:N,isOnDemandRevalidate:C})},!1,B),b}},k=await E.handleResponse({req:a,nextConfig:x,cacheKey:L,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:A,isRoutePPREnabled:!1,isOnDemandRevalidate:C,revalidateOnlyGenerated:D,responseGenerator:j,waitUntil:c.waitUntil,isMinimalMode:S});if(!J)return null;if((null==k||null==(h=k.value)?void 0:h.kind)!==u.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==k||null==(i=k.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});S||b.setHeader("x-nextjs-cache",C?"REVALIDATED":k.isMiss?"MISS":k.isStale?"STALE":"HIT"),z&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let l=(0,q.fromNodeOutgoingHttpHeaders)(k.value.headers);return S&&J||l.delete(s.NEXT_CACHE_TAGS_HEADER),!k.cacheControl||b.getHeader("Cache-Control")||l.get("Cache-Control")||l.set("Cache-Control",(0,r.getCacheControlHeader)(k.cacheControl)),await (0,p.I)(V,W,new Response(k.value.body,{headers:l,status:k.value.status||200})),null};R&&Q?await h(Q):(e=P.getActiveScopeSpan(),await P.withPropagatedContext(a.headers,()=>P.trace(n.BaseServerSpan.handleRequest,{spanName:`${O} ${d}`,kind:i.SpanKind.SERVER,attributes:{"http.method":O,"http.target":a.url}},h),void 0,!R))}catch(b){if(b instanceof t.NoFallbackError||await E.onRequestError(a,b,{routerKind:"App Router",routePath:I,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:N,isOnDemandRevalidate:C})},!1,B),J)throw b;return await (0,p.I)(V,W,new Response(null,{status:500})),null}}},455511:a=>{"use strict";a.exports=require("crypto")},476706:(a,b,c)=>{"use strict";c.d(b,{Kh:()=>f,Pz:()=>e});var d=c(215220);async function e(a,b){if(!a?.id||!b)return!1;if(a.role?.name==="MASTER_ADMIN")return!!await d.default.tenant.findUnique({where:{id:b},select:{id:!0}});if(a.tenantId===b||await d.default.tenant.findFirst({where:{id:b,ownerUserId:a.id},select:{id:!0}}))return!0;let[c,e]=await Promise.all([d.default.tenantMembership.findFirst({where:{userId:a.id,tenantId:b,status:{equals:"active",mode:"insensitive"}},select:{id:!0}}),d.default.user.findUnique({where:{id:a.id},select:{tenants:{where:{id:b},select:{id:!0}}}})]);return!!c||(e?.tenants?.length??0)>0}async function f(a,b=d.default){if(!a)return null;let c=await b.tenant.findUnique({where:{id:a},select:{id:!0,name:!0}});if(!c)return null;let e=await b.branch.findFirst({where:{tenantId:a},orderBy:{createdAt:"asc"},select:{id:!0,isActive:!0}});if(e)return e.isActive||await b.branch.update({where:{id:e.id},data:{isActive:!0}}),await b.tenant.update({where:{id:a},data:{defaultBranchId:e.id}}),e.id;let g=c.name?`${c.name} — stock`:"Main location",h=g.length>120?g.slice(0,120):g,i=await b.branch.create({data:{tenantId:a,name:h,isActive:!0},select:{id:!0}});return await b.tenant.update({where:{id:a},data:{defaultBranchId:i.id}}),i.id}},483636:a=>{"use strict";a.exports=import("puppeteer")},529294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},629021:a=>{"use strict";a.exports=require("fs")},643362:(a,b,c)=>{"use strict";c.d(b,{jR:()=>n});var d=c(305735),e=c(391986);let f=(...a)=>a.filter((a,b,c)=>!!a&&""!==a.trim()&&c.indexOf(a)===b).join(" ").trim();var g={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};let h=(0,e.forwardRef)(({color:a="currentColor",size:b=24,strokeWidth:c=2,absoluteStrokeWidth:d,className:h="",children:i,iconNode:j,...k},l)=>(0,e.createElement)("svg",{ref:l,...g,width:b,height:b,stroke:a,strokeWidth:d?24*Number(c)/Number(b):c,className:f("lucide",h),...k},[...j.map(([a,b])=>(0,e.createElement)(a,b)),...Array.isArray(i)?i:[i]])),i=(a,b)=>{let c=(0,e.forwardRef)(({className:c,...d},g)=>(0,e.createElement)(h,{ref:g,iconNode:b,className:f(`lucide-${a.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase()}`,c),...d}));return c.displayName=`${a}`,c},j=i("DollarSign",[["line",{x1:"12",x2:"12",y1:"2",y2:"22",key:"7eqyqh"}],["path",{d:"M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",key:"1b0p4s"}]]),k=i("Smartphone",[["rect",{width:"14",height:"20",x:"5",y:"2",rx:"2",ry:"2",key:"1yt0o3"}],["path",{d:"M12 18h.01",key:"mhygvu"}]]),l=i("CreditCard",[["rect",{width:"20",height:"14",x:"2",y:"5",rx:"2",key:"ynyp8z"}],["line",{x1:"2",x2:"22",y1:"10",y2:"10",key:"1b3vmo"}]]),m={bank_transfer:{name:"Bank Transfer",icon:(0,d.jsx)(j,{className:"w-4 h-4"}),color:"blue"},airtel_money:{name:"Airtel Money",icon:(0,d.jsx)(k,{className:"w-4 h-4"}),color:"purple"},mpamba:{name:"Mpamba",icon:(0,d.jsx)(j,{className:"w-4 h-4"}),color:"green"},cash:{name:"Cash",icon:(0,d.jsx)(j,{className:"w-4 h-4"}),color:"red"},paychangu:{name:"PayChangu",icon:(0,d.jsx)(l,{className:"w-4 h-4"}),color:"green"}},n=a=>{if(null==a||""===a)return"-";let b=String(a).trim(),c=b.toLowerCase().replace(/\s+/g,"_");return m[c]?.name?m[c].name:m[b]?.name?m[b].name:b.length>20&&/^[a-z0-9]+$/i.test(b)?"-":b.replace(/_/g," ").replace(/\b\w/g,a=>a.toUpperCase())};Object.entries(m).map(([a,b])=>({key:a,...b}))},663033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},665515:a=>{"use strict";a.exports=require("jspdf")},710846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},744870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},855312:(a,b,c)=>{"use strict";function d(a,b=80){let c=Number.isFinite(Number(b))?Math.min(90,Math.max(58,Math.round(Number(b)))):80;if(null==a||""===a)return c;let e=Number(a);return Number.isFinite(e)?Math.min(90,Math.max(58,Math.round(e))):c}function e(a){return Math.max(200,Math.round(96*d(a)/25.4))}function f(a){let b=d(a);return b<=58?{bodyPx:10,headerPx:13,grandPx:12,logoPx:44,labelMinPx:62,totalLabelMinPx:72}:b<=72?{bodyPx:11,headerPx:14,grandPx:13,logoPx:50,labelMinPx:72,totalLabelMinPx:84}:{bodyPx:12,headerPx:16,grandPx:14,logoPx:56,labelMinPx:80,totalLabelMinPx:95}}c.d(b,{JZ:()=>f,PK:()=>e,gn:()=>d}),Object.freeze([58,70,72,76,80,88,90])},896330:a=>{"use strict";a.exports=require("@prisma/client")},903295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},986439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")}};var b=require("../../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[64741,81813,65573,1026],()=>b(b.s=403026));module.exports=c})();