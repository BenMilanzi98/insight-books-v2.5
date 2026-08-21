"use strict";exports.id=73536,exports.ids=[73536],exports.modules={473536:(a,b,c)=>{c.d(b,{generateInvoiceHtml:()=>l,generateQuotationHtml:()=>m});var d=c(332863),e=c(390780),f=c(230863);function g(a){return a?String(a).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"):""}function h(a,b="MWK"){return(0,d.uB)(a,b)}function i(a){return(0,d.zi)(a)}function j(a){let b=a?.logoUrl;if(!b)return"";let c=b.startsWith("/uploads/")?`http://162.35.99.177:3000/api/uploads/${b.replace(/^\/+uploads\//,"")}`:b;return`<img src="${g(c)}" alt="" style="height:44px;object-fit:contain;max-height:56px;">`}let k=`
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;line-height:1.5;background:#fff;margin:0;padding:0}
.page{max-width:210mm;margin:0 auto;background:#fff}
table{border-collapse:collapse;width:100%}
.ib-doc-keep{break-inside:avoid;page-break-inside:avoid}
`;function l(a,b,c){let l,m=(0,f.P)(b?.content),n=m.layoutId||"classic",o=m.logoPosition||"left",p=m.primaryColor||c?.primaryColor||"#0075be",q=!1!==m.showFooter,r=["modern","band-header","bold-bar"].includes(n),s=c?.tpin&&String(c.tpin).trim()||"",t=a?.footerPhoneOverride!=null&&a?.footerPhoneOverride!==""?a.footerPhoneOverride:c?.businessPhone||"",u=a?.footerBankDetailsOverride!=null&&a?.footerBankDetailsOverride!==""?a.footerBankDetailsOverride:c?.defaultBankDetails||"",v="center"===o?"center":"right"===o?"flex-end":"flex-start",w=(l=j(c)||`<p style="font-size:18px;font-weight:600">${g(c?.companyName||"Company")}</p>`,"band-header"===n?`<div style="display:flex"><div style="flex:2;background:${p};color:#fff;padding:20px">${l}</div><div style="flex:3;background:#1e293b;color:#fff;padding:20px"><p style="font-size:22px;font-weight:700">Invoice</p><p style="opacity:.8">#${g(a.invoiceNumber)}</p></div></div>`:"bold-bar"===n?`<div style="border-top:6px solid ${p};padding:20px 24px"><div style="display:flex;flex-direction:column;align-items:${v}">${l}<p style="font-size:28px;font-weight:800;margin-top:8px">Invoice</p><p style="color:#64748b">#${g(a.invoiceNumber)}</p></div></div>`:"soft-card"===n?`<div style="padding:16px"><div style="border:1px solid #e5e7eb;border-radius:16px;padding:20px;box-shadow:0 1px 2px rgba(0,0,0,.04);display:flex;flex-direction:column;align-items:${v}">${l}<p style="font-size:22px;font-weight:600;margin-top:8px">Invoice</p><p style="color:#64748b">#${g(a.invoiceNumber)}</p></div></div>`:"ledger"===n?`<div style="padding:20px 24px;border-bottom:2px solid #1e293b"><div style="display:flex;justify-content:space-between;align-items:flex-end"><div style="display:flex;flex-direction:column;align-items:${v}">${l}<p style="font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:8px">Invoice</p></div><p style="font-family:ui-monospace,monospace">#${g(a.invoiceNumber)}</p></div></div>`:"split-brand"===n?`<div style="display:flex;border-bottom:1px solid #e5e7eb"><div style="flex:1;padding:20px;display:flex;flex-direction:column;align-items:${v}">${l}${s?`<p style="font-size:12px;color:#64748b;margin-top:8px">TPIN: ${g(s)}</p>`:""}</div><div style="flex:1;padding:20px;background:#f8fafc;border-left:1px solid #e5e7eb"><p style="font-size:20px;font-weight:700;color:${p}">Invoice</p><p style="color:#64748b">#${g(a.invoiceNumber)}</p></div></div>`:"minimal"===n||"compact"===n?`<div style="padding:${"compact"===n?"12px 16px":"24px"};display:flex;justify-content:space-between;align-items:flex-start"><div style="display:flex;flex-direction:column;align-items:${v}"><p style="font-size:${"compact"===n?"14px":"18px"};color:${p}">Invoice #${g(a.invoiceNumber)}</p>${l}</div></div>`:"editorial"===n?`<div style="padding:28px 24px 8px"><p style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${p}">Invoice</p></div><div style="display:flex;flex-direction:column;align-items:${v};padding:0 24px 16px">${l}<h1 style="font-size:26px;margin-top:12px">${g(a.title?.trim?.())||`Invoice ${g(a.invoiceNumber)}`}</h1><p style="color:#64748b;margin-top:8px">#${g(a.invoiceNumber)} \xb7 ${(0,d.Yq)(a.issueDate)}</p></div>`:`<div style="${r?`background:${p};color:#fff;`:`border-left:4px solid ${p};`}padding:24px 24px 16px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div style="display:flex;flex-direction:column;align-items:${v}">
        ${l}
        ${s?`<p style="margin-top:8px;font-size:12px;color:${r?"#e0f2fe":"#4b5563"}"><b>TPIN:</b> ${g(s)}</p>`:""}
      </div>
      <div style="text-align:right">
        <p style="font-size:24px;font-weight:700;color:${r?"#fff":"#111827"}">Invoice</p>
        <p style="font-size:14px;color:${r?"#e0f2fe":"#6b7280"};margin-top:2px">#${g(a.invoiceNumber)}</p>
        <span style="display:inline-block;margin-top:8px;padding:4px 10px;font-size:12px;font-weight:500;border-radius:6px;background:#f3f4f6;color:#374151">${g(a.status)}</span>
      </div>
    </div>
  </div>`),x=(a.items||[]).map(a=>{let b=parseFloat(a.quantity)||0,c=parseFloat(a.unitPrice)||0,d=parseFloat(a.discountAmount)||0,e=parseFloat(a.taxRate)||0,f=b*c-d,g=e/100*f;return{...a,qty:b,rate:c,disc:d,taxRate:e,taxAmt:g,net:f,amount:f+g}}),y=(0,e.Vr)(x),z=(0,e.ME)({taxAmount:a.taxAmount,taxLines:x.flatMap(a=>a.itemTaxes||[])}),A=x.map((a,b)=>`
    <tr style="background:${b%2==1?"#f9fafb":"#fff"}">
      <td style="padding:10px 8px;color:#111827;font-weight:500">${g(a.description)}</td>
      <td style="padding:10px 8px;text-align:right;color:#4b5563">${a.qty}</td>
      <td style="padding:10px 8px;text-align:right;color:#4b5563">${i(a.rate)}</td>
      <td style="padding:10px 8px;text-align:right">${a.disc>0?`<span style="color:#dc2626">-${i(a.disc)}</span>`:'<span style="color:#9ca3af">—</span>'}</td>
      ${y?`<td style="padding:10px 8px;text-align:right;color:#4b5563">${a.taxRate>0?`${a.taxRate}%`:"—"}</td>`:""}
      <td style="padding:10px 8px;text-align:right;font-weight:500;color:#111827">${i(a.amount)}</td>
    </tr>`).join(""),B=(a.payments||[]).filter(a=>a&&!a.isReversal&&(null==a.status||"Completed"===String(a.status))),C=B.reduce((a,b)=>a+(parseFloat(b.amount)||0),0),D=Math.max(0,(parseFloat(a.total)||0)-C);return`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${k}</style></head><body>
<div class="page" style="padding:28px">
  ${w}

  <!-- Bill To + Details -->
  <div style="padding:20px 24px;display:flex;gap:32px;background:#f9fafb">
    <div style="flex:1">
      <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:8px">Bill to</p>
      <p style="font-weight:600;color:#111827">${g(a.client?.name)}</p>
      ${a.client?.contactPerson?`<p style="font-size:14px;color:#4b5563">Attn: ${g(a.client.contactPerson)}</p>`:""}
      ${a.client?.address?`<p style="font-size:14px;color:#4b5563;margin-top:4px">${g(a.client.address)}</p>`:""}
      <p style="font-size:14px;color:#4b5563">${g(a.client?.email)}</p>
      ${a.client?.phone?`<p style="font-size:14px;color:#4b5563">Tel: ${g(a.client.phone)}</p>`:""}
    </div>
    <div style="flex:1">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:14px">
        <div><p style="color:#6b7280">Order #</p><p style="color:#111827">${g(a.orderNumber)||"—"}</p></div>
        <div><p style="color:#6b7280">Issue date</p><p style="color:#111827">${(0,d.Yq)(a.issueDate)}</p></div>
        <div><p style="color:#6b7280">Due date</p><p style="color:#111827">${(0,d.Yq)(a.dueDate)}</p></div>
      </div>
    </div>
  </div>

  <!-- Items -->
  <div style="padding:20px 24px">
    <h2 style="text-align:center;font-size:18px;font-weight:600;color:#111827;margin-bottom:16px">${g(a.title?.trim?.())||"Invoice"}</h2>
    <table style="font-size:14px">
      <thead>
        <tr style="border-bottom:2px solid #e5e7eb">
          <th style="text-align:left;padding:12px 8px;font-weight:600;color:#374151">Item</th>
          <th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151;width:50px">Qty</th>
          <th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151">Rate</th>
          <th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151">Discount</th>
          ${y?'<th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151">Tax</th>':""}
          <th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151">Amount</th>
        </tr>
      </thead>
      <tbody>${A}</tbody>
    </table>

    <!-- Totals -->
    <div class="ib-doc-keep" style="display:flex;justify-content:flex-end;margin-top:24px">
      <div style="width:256px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;padding:16px;font-size:14px">
        <div style="display:flex;justify-content:space-between;padding:6px 0;color:#4b5563"><span>Subtotal</span><span style="font-weight:500;color:#111827">${h(a.subtotal)}</span></div>
        ${z?`<div style="display:flex;justify-content:space-between;padding:6px 0;color:#4b5563"><span>Tax</span><span style="font-weight:500;color:#111827">${h(a.taxAmount)}</span></div>`:""}
        <div style="display:flex;justify-content:space-between;padding:12px 0 4px;margin-top:4px;border-top:2px solid #e5e7eb;color:${p}"><span style="font-weight:700">Total</span><span style="font-weight:700">${h(a.total)}</span></div>
        ${C>0||B.length>0?`
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb">
          <div style="display:flex;justify-content:space-between;padding:4px 0;color:#4b5563"><span>Paid</span><span style="font-weight:500;color:#059669">${h(C)}</span></div>
          ${D>0?`<div style="display:flex;justify-content:space-between;padding:4px 0;color:#4b5563"><span>Outstanding</span><span style="font-weight:500;color:#dc2626">${h(D)}</span></div>`:""}
        </div>`:""}
      </div>
    </div>
    ${B.length>0?`
    <div style="margin-top:20px;padding:16px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc">
      <p style="font-size:11px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px">Payment history</p>
      <table style="width:100%;font-size:13px;border-collapse:collapse">
        <thead><tr style="border-bottom:2px solid #e2e8f0;color:#64748b;text-align:left">
          <th style="padding:8px 6px">Date</th><th style="padding:8px 6px">Method</th><th style="padding:8px 6px">Reference</th><th style="padding:8px 6px;text-align:right">Amount</th>
        </tr></thead>
        <tbody>
          ${B.map(a=>`<tr style="border-bottom:1px solid #f1f5f9">
            <td style="padding:8px 6px;color:#334155">${(0,d.Yq)(a.paymentDate)}</td>
            <td style="padding:8px 6px;color:#334155">${g(a.paymentMethod||"")}</td>
            <td style="padding:8px 6px;color:#64748b">${a.reference?g(String(a.reference)):"—"}</td>
            <td style="padding:8px 6px;text-align:right;font-weight:500">${h(parseFloat(a.amount)||0)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`:""}
  </div>

  ${a.notes?`<div style="padding:20px 24px;border-top:1px solid #e5e7eb;background:#fafafa;font-size:14px;color:#374151;white-space:pre-line">${g(a.notes)}</div>`:""}

  <!-- Footer -->
  ${q?`
  <footer style="padding:24px;border-top:1px solid #e5e7eb;background:#f9fafb;font-size:14px">
    ${t||u?`<div style="color:#6b7280;margin-bottom:16px">
      ${t?`<p>Tel: ${g(t)}</p>`:""}
      ${u?`<pre style="white-space:pre-wrap;font-family:inherit;margin:0">${g(u)}</pre>`:""}
    </div>`:""}
    <p style="text-align:center;color:#4b5563;font-weight:500">${g(c?.emailFooter||"Thank you for your business!")}</p>
  </footer>`:""}
</div>
</body></html>`}function m(a,b,c){let d=(0,f.P)(b?.content),l=d.primaryColor||c?.primaryColor||"#0075be",m=!1!==d.showFooter,n=(a.items||[]).map(a=>{let b=parseFloat(a.quantity)||0,c=parseFloat(a.unitPrice)||0,d=parseFloat(a.taxRate)||0,e=b*c,f=d/100*e;return{...a,qty:b,rate:c,taxRate:d,taxAmt:f,net:e,amount:e+f}}),o=(0,e.Vr)(n),p=(0,e.ME)({taxAmount:a.taxAmount,taxLines:n.flatMap(a=>a.itemTaxes||[])}),q=n.map((a,b)=>`
    <tr style="background:${b%2==1?"#f9fafb":"#fff"}">
      <td style="padding:10px 8px;color:#111827;font-weight:500">${g(a.description)}</td>
      <td style="padding:10px 8px;text-align:right;color:#4b5563">${a.qty}</td>
      <td style="padding:10px 8px;text-align:right;color:#4b5563">${i(a.rate)}</td>
      ${o?`<td style="padding:10px 8px;text-align:right;color:#4b5563">${a.taxRate>0?`${a.taxRate}%`:"—"}</td>`:""}
      <td style="padding:10px 8px;text-align:right;font-weight:500;color:#111827">${i(a.amount)}</td>
    </tr>`).join(""),r=a.client||{};return`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${k}</style></head><body>
<div class="page" style="padding:28px">
  <!-- Header -->
  <div style="border-left:4px solid ${l};padding:24px 24px 16px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div>
        ${j(c)||`<p style="font-size:18px;font-weight:600;color:#111827">${g(c?.companyName||"Company")}</p>`}
      </div>
      <div style="text-align:right">
        <p style="font-size:24px;font-weight:700;color:#111827">Quotation</p>
        <p style="font-size:14px;color:#6b7280;margin-top:2px">#${g(a.quotationNumber)}</p>
        <span style="display:inline-block;margin-top:8px;padding:4px 10px;font-size:12px;font-weight:500;border-radius:6px;background:#f3f4f6;color:#374151">${g(a.status)}</span>
      </div>
    </div>
  </div>

  <!-- Client + Details -->
  <div style="padding:20px 24px;display:flex;gap:32px;background:#f9fafb">
    <div style="flex:1">
      <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:8px">Quotation for</p>
      <p style="font-weight:600;color:#111827">${g(r.name)}</p>
      ${r.contactPerson?`<p style="font-size:14px;color:#4b5563">Attn: ${g(r.contactPerson)}</p>`:""}
      ${r.address?`<p style="font-size:14px;color:#4b5563;margin-top:4px">${g(r.address)}</p>`:""}
      <p style="font-size:14px;color:#4b5563">${g(r.email)}</p>
      ${r.phone?`<p style="font-size:14px;color:#4b5563">Tel: ${g(r.phone)}</p>`:""}
    </div>
    <div style="flex:1">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:14px">
        <div><p style="color:#6b7280">Issue date</p><p style="color:#111827">${a.issueDate||""}</p></div>
        <div><p style="color:#6b7280">Valid until</p><p style="color:#111827">${a.validUntil||""}</p></div>
      </div>
    </div>
  </div>

  <!-- Items -->
  <div style="padding:20px 24px">
    <h2 style="text-align:center;font-size:18px;font-weight:600;color:#111827;margin-bottom:16px">${g(a.title?.trim?.())||"Quotation"}</h2>
    <table style="font-size:14px">
      <thead>
        <tr style="border-bottom:2px solid #e5e7eb">
          <th style="text-align:left;padding:12px 8px;font-weight:600;color:#374151">Description</th>
          <th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151;width:50px">Qty</th>
          <th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151">Rate</th>
          ${o?'<th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151">Tax</th>':""}
          <th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151">Amount</th>
        </tr>
      </thead>
      <tbody>${q}</tbody>
    </table>

    <!-- Totals -->
    <div class="ib-doc-keep" style="display:flex;justify-content:flex-end;margin-top:24px">
      <div style="width:256px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;padding:16px;font-size:14px">
        <div style="display:flex;justify-content:space-between;padding:6px 0;color:#4b5563"><span>Subtotal</span><span style="font-weight:500;color:#111827">${h(a.subtotal)}</span></div>
        ${p?`<div style="display:flex;justify-content:space-between;padding:6px 0;color:#4b5563"><span>Tax</span><span style="font-weight:500;color:#111827">${h(a.taxAmount)}</span></div>`:""}
        <div style="display:flex;justify-content:space-between;padding:12px 0 4px;margin-top:4px;border-top:2px solid #e5e7eb;color:${l}"><span style="font-weight:700">Total</span><span style="font-weight:700">${h(a.total)}</span></div>
      </div>
    </div>
  </div>

  ${a.notes?`<div style="padding:20px 24px;border-top:1px solid #e5e7eb;background:#fafafa;font-size:14px;color:#374151;white-space:pre-line">${g(a.notes)}</div>`:""}

  ${m?`
  <footer style="padding:24px;border-top:1px solid #e5e7eb;background:#f9fafb;font-size:14px">
    ${c?.businessPhone||c?.defaultBankDetails?`<div style="color:#6b7280;margin-bottom:16px">
      ${c.businessPhone?`<p>Tel: ${g(c.businessPhone)}</p>`:""}
      ${c.defaultBankDetails?`<pre style="white-space:pre-wrap;font-family:inherit;margin:0">${g(c.defaultBankDetails)}</pre>`:""}
    </div>`:""}
    <p style="text-align:center;color:#4b5563;font-weight:500">${g(c?.emailFooter||"Thank you for your business!")}</p>
  </footer>`:""}
</div>
</body></html>`}}};