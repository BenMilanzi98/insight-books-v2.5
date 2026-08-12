"use strict";exports.id=73536,exports.ids=[73536],exports.modules={473536:(a,b,c)=>{c.d(b,{generateInvoiceHtml:()=>k,generateQuotationHtml:()=>l});var d=c(332863),e=c(390780);function f(a){return a?String(a).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"):""}function g(a,b="MWK"){return(0,d.uB)(a,b)}function h(a){return(0,d.zi)(a)}function i(a){let b=a?.logoUrl;if(!b)return"";let c=b.startsWith("/uploads/")?`http://213.165.230.139:3000/api/uploads/${b.replace(/^\/+uploads\//,"")}`:b;return`<img src="${f(c)}" alt="" style="height:44px;object-fit:contain;max-height:56px;">`}let j=`
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;line-height:1.5;background:#fff;margin:0;padding:0}
.page{max-width:210mm;margin:0 auto;background:#fff}
table{border-collapse:collapse;width:100%}
`;function k(a,b,c){let k="string"==typeof b?.content?JSON.parse(b.content):b?.content||{},l=k.primaryColor||c?.primaryColor||"#0075be",m=String(k.style||"standard").toLowerCase(),n=!1!==k.showFooter,o=["bold","professional","modern"].includes(m),p=c?.tpin&&String(c.tpin).trim()||"",q=a?.footerPhoneOverride!=null&&a?.footerPhoneOverride!==""?a.footerPhoneOverride:c?.businessPhone||"",r=a?.footerBankDetailsOverride!=null&&a?.footerBankDetailsOverride!==""?a.footerBankDetailsOverride:c?.defaultBankDetails||"",s=(a.items||[]).map(a=>{let b=parseFloat(a.quantity)||0,c=parseFloat(a.unitPrice)||0,d=parseFloat(a.discountAmount)||0,e=parseFloat(a.taxRate)||0,f=b*c-d,g=e/100*f;return{...a,qty:b,rate:c,disc:d,taxRate:e,taxAmt:g,net:f,amount:f+g}}),t=(0,e.Vr)(s),u=(0,e.ME)({taxAmount:a.taxAmount,taxLines:s.flatMap(a=>a.itemTaxes||[])}),v=s.map((a,b)=>`
    <tr style="background:${b%2==1?"#f9fafb":"#fff"}">
      <td style="padding:10px 8px;color:#111827;font-weight:500">${f(a.description)}</td>
      <td style="padding:10px 8px;text-align:right;color:#4b5563">${a.qty}</td>
      <td style="padding:10px 8px;text-align:right;color:#4b5563">${h(a.rate)}</td>
      <td style="padding:10px 8px;text-align:right">${a.disc>0?`<span style="color:#dc2626">-${h(a.disc)}</span>`:'<span style="color:#9ca3af">—</span>'}</td>
      ${t?`<td style="padding:10px 8px;text-align:right;color:#4b5563">${a.taxRate>0?`${a.taxRate}%`:"—"}</td>`:""}
      <td style="padding:10px 8px;text-align:right;font-weight:500;color:#111827">${h(a.amount)}</td>
    </tr>`).join(""),w=(a.payments||[]).filter(a=>a&&!a.isReversal&&(null==a.status||"Completed"===String(a.status))),x=w.reduce((a,b)=>a+(parseFloat(b.amount)||0),0),y=Math.max(0,(parseFloat(a.total)||0)-x);return`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${j}</style></head><body>
<div class="page" style="padding:28px">
  <!-- Header -->
  <div style="${o?`background:${l};color:#fff;`:`border-left:4px solid ${l};`}padding:24px 24px 16px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div>
        ${i(c)||`<p style="font-size:18px;font-weight:600;color:${o?"#fff":"#111827"}">${f(c?.companyName||"Company")}</p>`}
        ${p?`<p style="margin-top:8px;font-size:12px;color:${o?"#e0f2fe":"#4b5563"}"><b>TPIN:</b> ${f(p)}</p>`:""}
      </div>
      <div style="text-align:right">
        <p style="font-size:24px;font-weight:700;color:${o?"#fff":"#111827"}">Invoice</p>
        <p style="font-size:14px;color:${o?"#e0f2fe":"#6b7280"};margin-top:2px">#${f(a.invoiceNumber)}</p>
        <span style="display:inline-block;margin-top:8px;padding:4px 10px;font-size:12px;font-weight:500;border-radius:6px;background:#f3f4f6;color:#374151">${f(a.status)}</span>
      </div>
    </div>
  </div>

  <!-- Bill To + Details -->
  <div style="padding:20px 24px;display:flex;gap:32px;background:#f9fafb">
    <div style="flex:1">
      <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:8px">Bill to</p>
      <p style="font-weight:600;color:#111827">${f(a.client?.name)}</p>
      ${a.client?.contactPerson?`<p style="font-size:14px;color:#4b5563">Attn: ${f(a.client.contactPerson)}</p>`:""}
      ${a.client?.address?`<p style="font-size:14px;color:#4b5563;margin-top:4px">${f(a.client.address)}</p>`:""}
      <p style="font-size:14px;color:#4b5563">${f(a.client?.email)}</p>
      ${a.client?.phone?`<p style="font-size:14px;color:#4b5563">Tel: ${f(a.client.phone)}</p>`:""}
    </div>
    <div style="flex:1">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:14px">
        <div><p style="color:#6b7280">Order #</p><p style="color:#111827">${f(a.orderNumber)||"—"}</p></div>
        <div><p style="color:#6b7280">Issue date</p><p style="color:#111827">${(0,d.Yq)(a.issueDate)}</p></div>
        <div><p style="color:#6b7280">Due date</p><p style="color:#111827">${(0,d.Yq)(a.dueDate)}</p></div>
      </div>
    </div>
  </div>

  <!-- Items -->
  <div style="padding:20px 24px">
    <h2 style="text-align:center;font-size:18px;font-weight:600;color:#111827;margin-bottom:16px">${f(a.title?.trim?.())||"Invoice"}</h2>
    <table style="font-size:14px">
      <thead>
        <tr style="border-bottom:2px solid #e5e7eb">
          <th style="text-align:left;padding:12px 8px;font-weight:600;color:#374151">Item</th>
          <th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151;width:50px">Qty</th>
          <th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151">Rate</th>
          <th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151">Discount</th>
          ${t?'<th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151">Tax</th>':""}
          <th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151">Amount</th>
        </tr>
      </thead>
      <tbody>${v}</tbody>
    </table>

    <!-- Totals -->
    <div style="display:flex;justify-content:flex-end;margin-top:24px">
      <div style="width:256px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;padding:16px;font-size:14px">
        <div style="display:flex;justify-content:space-between;padding:6px 0;color:#4b5563"><span>Subtotal</span><span style="font-weight:500;color:#111827">${g(a.subtotal)}</span></div>
        ${u?`<div style="display:flex;justify-content:space-between;padding:6px 0;color:#4b5563"><span>Tax</span><span style="font-weight:500;color:#111827">${g(a.taxAmount)}</span></div>`:""}
        <div style="display:flex;justify-content:space-between;padding:12px 0 4px;margin-top:4px;border-top:2px solid #e5e7eb;color:${l}"><span style="font-weight:700">Total</span><span style="font-weight:700">${g(a.total)}</span></div>
        ${x>0||w.length>0?`
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb">
          <div style="display:flex;justify-content:space-between;padding:4px 0;color:#4b5563"><span>Paid</span><span style="font-weight:500;color:#059669">${g(x)}</span></div>
          ${y>0?`<div style="display:flex;justify-content:space-between;padding:4px 0;color:#4b5563"><span>Outstanding</span><span style="font-weight:500;color:#dc2626">${g(y)}</span></div>`:""}
        </div>`:""}
      </div>
    </div>
    ${w.length>0?`
    <div style="margin-top:20px;padding:16px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc">
      <p style="font-size:11px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px">Payment history</p>
      <table style="width:100%;font-size:13px;border-collapse:collapse">
        <thead><tr style="border-bottom:2px solid #e2e8f0;color:#64748b;text-align:left">
          <th style="padding:8px 6px">Date</th><th style="padding:8px 6px">Method</th><th style="padding:8px 6px">Reference</th><th style="padding:8px 6px;text-align:right">Amount</th>
        </tr></thead>
        <tbody>
          ${w.map(a=>`<tr style="border-bottom:1px solid #f1f5f9">
            <td style="padding:8px 6px;color:#334155">${(0,d.Yq)(a.paymentDate)}</td>
            <td style="padding:8px 6px;color:#334155">${f(a.paymentMethod||"")}</td>
            <td style="padding:8px 6px;color:#64748b">${a.reference?f(String(a.reference)):"—"}</td>
            <td style="padding:8px 6px;text-align:right;font-weight:500">${g(parseFloat(a.amount)||0)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`:""}
  </div>

  ${a.notes?`<div style="padding:20px 24px;border-top:1px solid #e5e7eb;background:#fafafa;font-size:14px;color:#374151;white-space:pre-line">${f(a.notes)}</div>`:""}

  <!-- Footer -->
  ${n?`
  <footer style="padding:24px;border-top:1px solid #e5e7eb;background:#f9fafb;font-size:14px">
    ${q||r?`<div style="color:#6b7280;margin-bottom:16px">
      ${q?`<p>Tel: ${f(q)}</p>`:""}
      ${r?`<pre style="white-space:pre-wrap;font-family:inherit;margin:0">${f(r)}</pre>`:""}
    </div>`:""}
    <p style="text-align:center;color:#4b5563;font-weight:500">${f(c?.emailFooter||"Thank you for your business!")}</p>
  </footer>`:""}
</div>
</body></html>`}function l(a,b,c){let d="string"==typeof b?.content?JSON.parse(b.content):b?.content||{},k=d.primaryColor||c?.primaryColor||"#0075be",l=!1!==d.showFooter,m=(a.items||[]).map(a=>{let b=parseFloat(a.quantity)||0,c=parseFloat(a.unitPrice)||0,d=parseFloat(a.taxRate)||0,e=b*c,f=d/100*e;return{...a,qty:b,rate:c,taxRate:d,taxAmt:f,net:e,amount:e+f}}),n=(0,e.Vr)(m),o=(0,e.ME)({taxAmount:a.taxAmount,taxLines:m.flatMap(a=>a.itemTaxes||[])}),p=m.map((a,b)=>`
    <tr style="background:${b%2==1?"#f9fafb":"#fff"}">
      <td style="padding:10px 8px;color:#111827;font-weight:500">${f(a.description)}</td>
      <td style="padding:10px 8px;text-align:right;color:#4b5563">${a.qty}</td>
      <td style="padding:10px 8px;text-align:right;color:#4b5563">${h(a.rate)}</td>
      ${n?`<td style="padding:10px 8px;text-align:right;color:#4b5563">${a.taxRate>0?`${a.taxRate}%`:"—"}</td>`:""}
      <td style="padding:10px 8px;text-align:right;font-weight:500;color:#111827">${h(a.amount)}</td>
    </tr>`).join(""),q=a.client||{};return`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${j}</style></head><body>
<div class="page" style="padding:28px">
  <!-- Header -->
  <div style="border-left:4px solid ${k};padding:24px 24px 16px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div>
        ${i(c)||`<p style="font-size:18px;font-weight:600;color:#111827">${f(c?.companyName||"Company")}</p>`}
      </div>
      <div style="text-align:right">
        <p style="font-size:24px;font-weight:700;color:#111827">Quotation</p>
        <p style="font-size:14px;color:#6b7280;margin-top:2px">#${f(a.quotationNumber)}</p>
        <span style="display:inline-block;margin-top:8px;padding:4px 10px;font-size:12px;font-weight:500;border-radius:6px;background:#f3f4f6;color:#374151">${f(a.status)}</span>
      </div>
    </div>
  </div>

  <!-- Client + Details -->
  <div style="padding:20px 24px;display:flex;gap:32px;background:#f9fafb">
    <div style="flex:1">
      <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:8px">Quotation for</p>
      <p style="font-weight:600;color:#111827">${f(q.name)}</p>
      ${q.contactPerson?`<p style="font-size:14px;color:#4b5563">Attn: ${f(q.contactPerson)}</p>`:""}
      ${q.address?`<p style="font-size:14px;color:#4b5563;margin-top:4px">${f(q.address)}</p>`:""}
      <p style="font-size:14px;color:#4b5563">${f(q.email)}</p>
      ${q.phone?`<p style="font-size:14px;color:#4b5563">Tel: ${f(q.phone)}</p>`:""}
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
    <h2 style="text-align:center;font-size:18px;font-weight:600;color:#111827;margin-bottom:16px">${f(a.title?.trim?.())||"Quotation"}</h2>
    <table style="font-size:14px">
      <thead>
        <tr style="border-bottom:2px solid #e5e7eb">
          <th style="text-align:left;padding:12px 8px;font-weight:600;color:#374151">Description</th>
          <th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151;width:50px">Qty</th>
          <th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151">Rate</th>
          ${n?'<th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151">Tax</th>':""}
          <th style="text-align:right;padding:12px 8px;font-weight:600;color:#374151">Amount</th>
        </tr>
      </thead>
      <tbody>${p}</tbody>
    </table>

    <!-- Totals -->
    <div style="display:flex;justify-content:flex-end;margin-top:24px">
      <div style="width:256px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;padding:16px;font-size:14px">
        <div style="display:flex;justify-content:space-between;padding:6px 0;color:#4b5563"><span>Subtotal</span><span style="font-weight:500;color:#111827">${g(a.subtotal)}</span></div>
        ${o?`<div style="display:flex;justify-content:space-between;padding:6px 0;color:#4b5563"><span>Tax</span><span style="font-weight:500;color:#111827">${g(a.taxAmount)}</span></div>`:""}
        <div style="display:flex;justify-content:space-between;padding:12px 0 4px;margin-top:4px;border-top:2px solid #e5e7eb;color:${k}"><span style="font-weight:700">Total</span><span style="font-weight:700">${g(a.total)}</span></div>
      </div>
    </div>
  </div>

  ${a.notes?`<div style="padding:20px 24px;border-top:1px solid #e5e7eb;background:#fafafa;font-size:14px;color:#374151;white-space:pre-line">${f(a.notes)}</div>`:""}

  ${l?`
  <footer style="padding:24px;border-top:1px solid #e5e7eb;background:#f9fafb;font-size:14px">
    ${c?.businessPhone||c?.defaultBankDetails?`<div style="color:#6b7280;margin-bottom:16px">
      ${c.businessPhone?`<p>Tel: ${f(c.businessPhone)}</p>`:""}
      ${c.defaultBankDetails?`<pre style="white-space:pre-wrap;font-family:inherit;margin:0">${f(c.defaultBankDetails)}</pre>`:""}
    </div>`:""}
    <p style="text-align:center;color:#4b5563;font-weight:500">${f(c?.emailFooter||"Thank you for your business!")}</p>
  </footer>`:""}
</div>
</body></html>`}}};