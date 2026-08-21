(()=>{var a={};a.id=61336,a.ids=[61336],a.modules={12014:(a,b,c)=>{"use strict";c.d(b,{$w:()=>m,Ai:()=>j,By:()=>k,M9:()=>p,NH:()=>e,Rg:()=>i,TI:()=>d,Wj:()=>g,Zx:()=>n,a3:()=>t,g7:()=>h,iG:()=>q,jB:()=>o,jz:()=>u,mf:()=>f,qy:()=>l});let d=100,e=.005,f=.01;function g(a,b=f){return Math.abs(k(a))>=b}function h(a){if(null==a||""===a)return 0;if("number"==typeof a)return Number.isFinite(a)?a:0;if("object"==typeof a&&"function"==typeof a.toNumber){let b=a.toNumber();return Number.isFinite(b)?b:0}let b=String(a).replace(/,/g,"").trim();if(!b)return 0;let c=Number(b);return Number.isFinite(c)?c:0}function i(a){let b=h(a);return(b<0?-1:1)*Math.round(Math.abs(b)*d+1e-8)}function j(a){let b=Number(a);return Number.isFinite(b)?b/d:0}function k(a){return j(i(a))}function l(...a){let b=0;for(let c of a)b+=i(c);return j(b)}function m(a,b){return j(i(a)-i(b))}function n(a,b){return j(Math.round(i(a)*i(b)/d))}function o(a,b){return j(Math.round(i(a)*h(b)/100))}function p(a){return Array.isArray(a)?l(...a):0}function q(a,b=0,c=1/0){return j(Math.min(Math.max(i(a),i(b)),i(c===1/0?1e15:c)))}function r(a,b){let c=i(a)-i(b);return c<0?-1:+(c>0)}function s(a,b,c=e){return Math.abs(m(a,b))<=c}function t(a,b,c=e){return r(a,b)>=0||s(a,b,c)}function u(a,b,c=e){return 0>=r(a,b)||s(a,b,c)}},78335:()=>{},176760:a=>{"use strict";a.exports=require("node:path")},181280:(a,b,c)=>{"use strict";c.d(b,{F:()=>g,q:()=>f});var d=c(215220),e=c(476706);async function f(a,b=d.default){return a?(0,e.Kh)(a,b):null}async function g(a){if(!a?.tenantId)return a.primaryBranchId=null,a.currentBranchId=null,a.allowedBranchIds=null,a;let b=await f(a.tenantId);return a.primaryBranchId=b,a.currentBranchId=b,a.defaultBranchId=b,a.allowedBranchIds=null,a}},200261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},215220:(a,b,c)=>{"use strict";c.r(b),c.d(b,{default:()=>g,prisma:()=>f});var d=c(896330);let e=global,f=(e.prisma,e.prisma||(e.prisma=new d.PrismaClient({log:["error"]})),e.prisma),g=f},296487:()=>{},383501:a=>{"use strict";a.exports=import("jspdf-autotable")},455511:a=>{"use strict";a.exports=require("crypto")},476706:(a,b,c)=>{"use strict";c.d(b,{Kh:()=>f,Pz:()=>e});var d=c(215220);async function e(a,b){if(!a?.id||!b)return!1;if(a.role?.name==="MASTER_ADMIN")return!!await d.default.tenant.findUnique({where:{id:b},select:{id:!0}});if(a.tenantId===b||await d.default.tenant.findFirst({where:{id:b,ownerUserId:a.id},select:{id:!0}}))return!0;let[c,e]=await Promise.all([d.default.tenantMembership.findFirst({where:{userId:a.id,tenantId:b,status:{equals:"active",mode:"insensitive"}},select:{id:!0}}),d.default.user.findUnique({where:{id:a.id},select:{tenants:{where:{id:b},select:{id:!0}}}})]);return!!c||(e?.tenants?.length??0)>0}async function f(a,b=d.default){if(!a)return null;let c=await b.tenant.findUnique({where:{id:a},select:{id:!0,name:!0}});if(!c)return null;let e=await b.branch.findFirst({where:{tenantId:a},orderBy:{createdAt:"asc"},select:{id:!0,isActive:!0}});if(e)return e.isActive||await b.branch.update({where:{id:e.id},data:{isActive:!0}}),await b.tenant.update({where:{id:a},data:{defaultBranchId:e.id}}),e.id;let g=c.name?`${c.name} — stock`:"Main location",h=g.length>120?g.slice(0,120):g,i=await b.branch.create({data:{tenantId:a,name:h,isActive:!0},select:{id:!0}});return await b.tenant.update({where:{id:a},data:{defaultBranchId:i.id}}),i.id}},483636:a=>{"use strict";a.exports=import("puppeteer")},487550:a=>{"use strict";a.exports=require("better-sqlite3")},529294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},530087:(a,b,c)=>{"use strict";function d(a){let b=Number(a);return Number.isFinite(b)?b:0}function e(a){return Math.round(100*d(a))/100}function f(a){if(!a||"string"!=typeof a)return{};try{let b=JSON.parse(a);return b&&"object"==typeof b?b:{}}catch{return{}}}function g(a,b){let c=Number(a);return Number.isFinite(c)&&c>=0?c:Number.isFinite(Number(b))?Number(b):0}function h(a,b={}){let c=f(a?.notes),i=g(b.npsEmployeeRatePercent??b.employeeRatePercent,5),j=g(b.npsEmployerRatePercent??b.employerRatePercent,5),k=g(c.npsEmployeeRatePercent,i),l=g(c.npsEmployerRatePercent,j),m=d(a?.totalNpsAmount),n=void 0!==c.npsEmployeeAmount||void 0!==c.npsEmployerAmount,o=n?d(c.npsEmployeeAmount):0,p=n?d(c.npsEmployerAmount):0;if(!n&&m>0){let a=function(a,b,c){let f=d(a);if(f<=0)return{employeeAmount:0,employerAmount:0};let g=d(b),h=g+d(c);if(h<=0)return{employeeAmount:e(f/2),employerAmount:e(f/2)};let i=e(f*g/h);return{employeeAmount:i,employerAmount:e(f-i)}}(m,k,l);o=a.employeeAmount,p=a.employerAmount}b.excludeClearedEmployer&&c.pensionClearedEmployer&&(p=0);let q=o||p?e(o+p):e(m),r=b.signed&&a?.status==="Reversed"?-1:1;return{payeAmount:e(r*d(a?.payeAmount)),npsEmployeeAmount:e(r*o),npsEmployerAmount:e(r*p),totalNpsAmount:e(r*q),npsEmployeeRatePercent:k,npsEmployerRatePercent:l,payeTaxableIncome:c.payeTaxableIncome??null,notes:c}}c.d(b,{if:()=>f,wx:()=>h})},568266:(a,b,c)=>{"use strict";c.d(b,{ot:()=>f,vv:()=>e});var d=c(12014);let e=(a,b="MWK",c=2)=>{if(null==a)return`${b} 0.00`;let e=new Intl.NumberFormat("en-MW",{minimumFractionDigits:c,maximumFractionDigits:c}).format((0,d.g7)(a));return`${b} ${e}`},f=(a,b="MWK")=>{if(null==a)return`${b} 0`;let c=(0,d.g7)(a);if(Number.isNaN(c))return`${b} 0`;let e=c===Math.round(c),f=new Intl.NumberFormat("en-MW",{minimumFractionDigits:2*!e,maximumFractionDigits:2*!e}).format(c);return`${b} ${f}`}},629021:a=>{"use strict";a.exports=require("fs")},663033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},665515:a=>{"use strict";a.exports=require("jspdf")},703394:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>J,patchFetch:()=>I,routeModule:()=>E,serverHooks:()=>H,workAsyncStorage:()=>F,workUnitAsyncStorage:()=>G});var d={};c.r(d),c.d(d,{GET:()=>A});var e=c(319225),f=c(684006),g=c(8317),h=c(799373),i=c(434775),j=c(524235),k=c(200261),l=c(754365),m=c(590771),n=c(473461),o=c(767798),p=c(192280),q=c(662018),r=c(445696),s=c(347929),t=c(986439),u=c(137527),v=c(945592),w=c(215220),x=c(701026),y=c(568266),z=c(530087);async function A(a,{params:b}){let{id:c}=await b,d=String(c);try{var e;let b,c,f,g,h,i,j,k,l,m=await (0,x.Ux)(a);if(!m)return v.NextResponse.json({error:"Authentication required"},{status:401});let n=await w.default.payroll.findFirst({where:{id:d,tenantId:m.tenantId},include:{employee:{include:{tenant:{include:{settings:!0}}}}}});if(!n||!n.employee)return v.NextResponse.json({error:"Payroll or employee not found"},{status:404});let o=(b=(e=n).basicSalary||0,c=e.additions||0,f=(0,z.wx)(e),g=Number(e.grossPay||b||0)||0,h=f.payeAmount||0,i=f.npsEmployeeAmount||0,j=Math.max(0,(Number(e.deductions||0)||0)-h-i),k=e.netPay||0,{id:e.id,employee:e.employee,periodStart:e.periodStart,periodEnd:e.periodEnd,paymentDate:e.paymentDate,status:e.status,basicSalary:b,additions:c,deductions:j,pension:i,paye:h,deductionsTotal:j+i+h,netPay:k,tax:h,grossPay:g,totalEarnings:g+c,refNumber:`PS-${e.id.substring(0,8).toUpperCase()}`,issueDate:new Date().toISOString(),payPeriod:`${new Date(e.periodStart).toLocaleString("default",{month:"long"})} ${new Date(e.periodStart).getFullYear()}`,benefits:{},benefitsTotal:0});try{l=await C(o)}catch(a){console.warn("Puppeteer PDF generation failed, falling back to jsPDF:",a),l=await D(o)}return new v.NextResponse(l,{status:200,headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="payslip-${n.employee.name}-${o.payPeriod}.pdf"`}})}catch(a){return console.error("Error generating payslip:",a),v.NextResponse.json({error:`Failed to generate payslip: ${a.message}`},{status:500})}}function B(a){if(!a)return"N/A";try{return new Date(a).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}catch(a){return"Invalid Date"}}async function C(a){try{let{launchPuppeteer:b,PDF_SET_CONTENT_OPTIONS:d}=await c.e(92678).then(c.bind(c,392678)),e=a.employee.tenant,f=e.settings,g=function(a,b,c){let d="";if(b.logoUrl){let a=b.logoUrl.startsWith("http")?b.logoUrl:`http://162.35.99.177:3000${b.logoUrl}`;d=`<img src="${a}" alt="Company Logo" class="logo">`}let e="";if(c&&(c.buildingName&&(e+=`<div class="company-info">${c.buildingName}</div>`),c.businessAddress&&(e+=`<div class="company-info">${c.businessAddress}</div>`),c.businessCity&&(e+=`<div class="company-info">${c.businessCity}</div>`),c.businessPhone||c.businessEmail)){let a="";c.businessPhone&&(a+=`Tel: ${c.businessPhone}`),c.businessPhone&&c.businessEmail&&(a+=" | "),c.businessEmail&&(a+=`Email: ${c.businessEmail}`),e+=`<div class="company-info">${a}</div>`}return e||(e=`
      <div class="company-info">123 Business Park, Lilongwe, Malawi</div>
      <div class="company-info">Tel: +265 1 234 5678 | Email: hr@company.com</div>
    `),`
    <div class="payslip">
      <div class="payslip-frame">
        <div class="accent-bar"></div>
        <div class="header">
          ${d}
          <div class="company-name">${b.name||"InsightBooks"}</div>
          ${e}
        </div>

        <div class="title-row">
          <span class="pill">PAYSLIP</span>
          <span class="period-chip">Pay Period: ${a.payPeriod}</span>
        </div>

        <div class="meta-section">
          <strong>Ref:</strong> ${a.refNumber}
          &nbsp;\xb7&nbsp;
          <strong>Issue date:</strong> ${B(a.issueDate)}
        </div>

        <div class="employee-details">
          <h3>Employee information</h3>
          <div class="details-grid">
            <div class="detail-item">
              <div class="detail-label">Employee</div>
              <div class="detail-value">${a.employee.name}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Employee ID</div>
              <div class="detail-value">${a.employee.id}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Position</div>
              <div class="detail-value">${a.employee.position||"N/A"}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Department</div>
              <div class="detail-value">${a.employee.department||"N/A"}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Payment date</div>
              <div class="detail-value">${a.paymentDate?B(a.paymentDate):"Pending"}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Tax ID</div>
              <div class="detail-value">${a.employee.taxID||"N/A"}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Bank account</div>
              <div class="detail-value">${a.employee.bankAccount||"N/A"}</div>
            </div>
          </div>
        </div>

        <div class="earnings-section">
          <h3 class="section-title">Earnings</h3>
          <div class="table-wrap">
            <table class="table table-earnings">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Basic salary</td>
                  <td>${(0,y.ot)(a.basicSalary)}</td>
                </tr>
                ${a.additions>0?`
                <tr>
                  <td>Benefits &amp; allowances (after tax)</td>
                  <td>${(0,y.ot)(a.additions)}</td>
                </tr>
                `:""}
                <tr class="total-row">
                  <td>Taxable gross pay</td>
                  <td>${(0,y.ot)(a.grossPay)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="deductions-section">
          <h3 class="section-title">Deductions</h3>
          <div class="table-wrap">
            <table class="table table-deductions">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${Number(a.deductions)>0?`
                <tr>
                  <td>Other deductions</td>
                  <td>${(0,y.ot)(a.deductions)}</td>
                </tr>
                `:""}
                <tr>
                  <td>Pension (NPS)</td>
                  <td>${(0,y.ot)(a.pension||0)}</td>
                </tr>
                <tr>
                  <td>Income tax (PAYE)</td>
                  <td>${(0,y.ot)(a.paye||0)}</td>
                </tr>
                <tr class="total-row">
                  <td>Total deductions</td>
                  <td>${(0,y.ot)(a.deductionsTotal||0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="net-pay">
          <div class="net-pay-inner">
            <div class="net-pay-label">NET PAY</div>
            <div class="net-pay-amount">${(0,y.ot)(a.netPay)}</div>
          </div>
        </div>

        <div class="footer">
          <p>This is a computer-generated document and does not require a signature.</p>
          <p>For any queries regarding this payslip, please contact the HR department.</p>
        </div>
      </div>
    </div>
  `}(a,e,f),h=`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payslip - ${a.employee.name}</title>
          <style>
            @page {
              margin: 0.45in;
              size: A4;
            }
            body {
              font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              margin: 0;
              padding: 0;
              line-height: 1.45;
              color: #1e293b;
              background: #f1f5f9;
            }
            .payslip {
              max-width: 720px;
              margin: 0 auto;
              padding: 8px 0 24px;
            }
            .payslip-frame {
              background: #fff;
              border-radius: 12px;
              box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08);
              border: 1px solid #e2e8f0;
              overflow: hidden;
            }
            .accent-bar {
              height: 5px;
              background: linear-gradient(90deg, #0d9488 0%, #2563eb 50%, #7c3aed 100%);
            }
            .header {
              text-align: center;
              padding: 22px 24px 18px;
              border-bottom: 1px solid #e2e8f0;
              background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
            }
            .logo {
              max-height: 72px;
              max-width: 200px;
              object-fit: contain;
              margin-bottom: 12px;
            }
            .company-name {
              font-size: 22px;
              font-weight: 700;
              color: #0f172a;
              letter-spacing: -0.02em;
            }
            .company-info {
              font-size: 13px;
              color: #64748b;
              margin-top: 4px;
            }
            .title-row {
              display: flex;
              flex-wrap: wrap;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              padding: 18px 24px 12px;
            }
            .pill {
              display: inline-block;
              font-size: 13px;
              font-weight: 700;
              letter-spacing: 0.12em;
              color: #fff;
              background: linear-gradient(135deg, #0d9488, #2563eb);
              padding: 8px 16px;
              border-radius: 999px;
            }
            .period-chip {
              font-size: 14px;
              font-weight: 600;
              color: #475569;
              background: #e0f2fe;
              border: 1px solid #bae6fd;
              padding: 8px 14px;
              border-radius: 8px;
            }
            .meta-section {
              margin: 0 24px 20px;
              padding: 14px 16px;
              background: #f8fafc;
              border-radius: 8px;
              border-left: 4px solid #2563eb;
              font-size: 13px;
              color: #334155;
            }
            .meta-section strong {
              color: #0f172a;
            }
            .employee-details {
              margin: 0 24px 22px;
            }
            .employee-details h3 {
              font-size: 15px;
              font-weight: 700;
              color: #0f172a;
              margin: 0 0 12px;
              padding-bottom: 8px;
              border-bottom: 2px solid #e2e8f0;
            }
            .details-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px 20px;
            }
            .detail-item {
              padding: 10px 12px;
              background: #f8fafc;
              border-radius: 8px;
              border: 1px solid #e2e8f0;
            }
            .detail-label {
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              color: #64748b;
              margin-bottom: 4px;
            }
            .detail-value {
              font-size: 14px;
              font-weight: 600;
              color: #0f172a;
            }
            .earnings-section, .deductions-section {
              margin: 0 24px 22px;
            }
            .section-title {
              font-size: 15px;
              font-weight: 700;
              color: #0f172a;
              margin: 0 0 10px;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .section-title::before {
              content: '';
              width: 4px;
              height: 18px;
              border-radius: 2px;
            }
            .earnings-section .section-title::before {
              background: #0d9488;
            }
            .deductions-section .section-title::before {
              background: #6366f1;
            }
            .table-wrap {
              border-radius: 10px;
              overflow: hidden;
              border: 1px solid #e2e8f0;
            }
            .table {
              width: 100%;
              border-collapse: collapse;
              font-size: 14px;
            }
            .table th, .table td {
              padding: 12px 14px;
              text-align: left;
            }
            .table thead th {
              font-weight: 700;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #fff;
            }
            .table-earnings thead th {
              background: linear-gradient(135deg, #0f766e, #0d9488);
            }
            .table-deductions thead th {
              background: linear-gradient(135deg, #4338ca, #6366f1);
            }
            .table tbody tr:nth-child(odd) {
              background: #f8fafc;
            }
            .table tbody tr:nth-child(even) {
              background: #fff;
            }
            .table tbody td {
              border-bottom: 1px solid #e2e8f0;
              color: #334155;
            }
            .table tbody tr:last-child td {
              border-bottom: none;
            }
            .table .total-row {
              font-weight: 700;
              background: #ecfdf5 !important;
              color: #065f46;
            }
            .table-deductions .total-row {
              background: #eef2ff !important;
              color: #3730a3;
            }
            .table td:last-child, .table th:last-child {
              text-align: right;
              font-variant-numeric: tabular-nums;
            }
            .net-pay {
              margin: 24px;
              padding: 0;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 8px 28px rgba(15, 23, 42, 0.18);
            }
            .net-pay-inner {
              display: flex;
              align-items: center;
              justify-content: space-between;
              flex-wrap: wrap;
              gap: 12px;
              padding: 20px 24px;
              background: linear-gradient(125deg, #0f172a 0%, #1e3a5f 45%, #0f766e 100%);
            }
            .net-pay-label {
              font-size: 14px;
              font-weight: 800;
              letter-spacing: 0.14em;
              color: #e2e8f0;
            }
            .net-pay-amount {
              font-size: 28px;
              font-weight: 800;
              color: #6ee7b7;
              text-shadow: 0 1px 2px rgba(0,0,0,0.25);
            }
            .footer {
              margin: 0 24px 20px;
              text-align: center;
              font-size: 11px;
              color: #64748b;
              padding-top: 16px;
              border-top: 1px solid #e2e8f0;
            }
            .footer p {
              margin: 4px 0;
            }
          </style>
        </head>
        <body>
          ${g}
        </body>
      </html>
    `,i=await b(),j=await i.newPage();await j.setContent(h,d);let k=await j.pdf({format:"A4",printBackground:!0,margin:{top:"0.4in",right:"0.4in",bottom:"0.4in",left:"0.4in"}});return await i.close(),k}catch(a){throw console.error("Error generating payslip PDF with Puppeteer:",a),a}}async function D(a){try{let b=(await Promise.resolve().then(c.t.bind(c,665515,23))).default,d=(await Promise.resolve().then(c.bind(c,383501))).default,e=new b({orientation:"portrait",unit:"mm",format:"a4"}),f=20,g=a.employee.tenant,h=g.settings;if(g.logoUrl)try{let a=function(a,b,c){try{let d=(b.split("/").pop().split(".")[0]||"LOGO").substring(0,2).toUpperCase();return a.setFillColor(13,148,136),a.circle(40,c+15,15,"F"),a.setTextColor(255,255,255),a.setFontSize(12),a.setFont("helvetica","bold"),a.text(d,40,c+18,{align:"center"}),35}catch(a){return console.warn("Could not create logo placeholder:",a),0}}(e,g.logoUrl,f);if(a>0)f+=a;else throw Error("Logo creation failed")}catch(a){console.warn("Could not add logo, falling back to company name:",a),e.setFontSize(18),e.setFont("helvetica","bold"),e.setTextColor(0,0,0),e.text(g.name||"InsightBooks",105,f,{align:"center"}),f+=15}else e.setFontSize(18),e.setFont("helvetica","bold"),e.setTextColor(0,0,0),e.text(g.name||"InsightBooks",105,f,{align:"center"}),f+=15;if(h&&(e.setFontSize(10),e.setFont("helvetica","normal"),h.buildingName&&(e.text(h.buildingName,105,f,{align:"center"}),f+=5),h.businessAddress&&(e.text(h.businessAddress,105,f,{align:"center"}),f+=5),h.businessCity&&(e.text(h.businessCity,105,f,{align:"center"}),f+=5),h.businessPhone||h.businessEmail)){let a="";h.businessPhone&&(a+=`Tel: ${h.businessPhone}`),h.businessPhone&&h.businessEmail&&(a+=" | "),h.businessEmail&&(a+=`Email: ${h.businessEmail}`),e.text(a,105,f,{align:"center"}),f+=5}e.setFillColor(13,148,136),e.rect(20,f,e.internal.pageSize.getWidth()-40,2.5,"F"),f+=8,e.setFontSize(16),e.setFont("helvetica","bold"),e.setTextColor(15,23,42),e.text("PAYSLIP",105,f+4,{align:"center"}),f+=12,e.setFontSize(10),e.setFont("helvetica","normal"),e.setTextColor(71,85,105),e.text(`Pay Period: ${a.payPeriod}`,105,f,{align:"center"}),f+=10,d(e,{startY:f,head:[["Employee information",""]],body:[["Employee Name:",a.employee.name||"N/A"],["Position:",a.employee.position||"N/A"],["Department:",a.employee.department||"N/A"],["Payment Date:",a.paymentDate?B(a.paymentDate):"Pending"],["Employee ID:",a.employee.id.substring(0,8)],["Tax ID:","N/A"],["Bank Account:","N/A"]],headStyles:{fillColor:[241,245,249],textColor:[15,23,42],fontStyle:"bold",fontSize:10},columnStyles:{0:{fontStyle:"bold",cellWidth:52,textColor:[71,85,105]},1:{textColor:[15,23,42],fontStyle:"normal"}},margin:{left:20,right:20},theme:"grid",styles:{fontSize:10,cellPadding:2.5,lineColor:[226,232,240],lineWidth:.1}}),f=e.lastAutoTable.finalY+10,e.setFontSize(11),e.setFont("helvetica","bold"),e.setTextColor(15,118,110),e.text("Earnings",20,f),f+=5,d(e,{startY:f,head:[["Description","Amount"]],body:[["Basic Salary",(0,y.ot)(a.basicSalary)],...a.additions>0?[["Benefits & Allowances (after tax)",(0,y.ot)(a.additions)]]:[],["Taxable Gross Pay",(0,y.ot)(a.grossPay)]],headStyles:{fillColor:[15,118,110],textColor:255,fontStyle:"bold",fontSize:9},alternateRowStyles:{fillColor:[248,250,252]},margin:{left:20,right:20},theme:"striped",columnStyles:{1:{halign:"right"}},styles:{fontSize:10,cellPadding:3}}),f=e.lastAutoTable.finalY+10,e.setFontSize(11),e.setFont("helvetica","bold"),e.setTextColor(67,56,202),e.text("Deductions",20,f),f+=5;let i=[];Number(a.deductions)>0&&i.push(["Other deductions",(0,y.ot)(a.deductions)]),i.push(["Pension (NPS)",(0,y.ot)(a.pension||0)],["Income Tax (PAYE)",(0,y.ot)(a.paye||0)],["Total Deductions",(0,y.ot)(a.deductionsTotal||0)]),d(e,{startY:f,head:[["Description","Amount"]],body:i,headStyles:{fillColor:[79,70,229],textColor:255,fontStyle:"bold",fontSize:9},alternateRowStyles:{fillColor:[248,250,252]},margin:{left:20,right:20},theme:"striped",columnStyles:{1:{halign:"right"}},styles:{fontSize:10,cellPadding:3},didParseCell:a=>{"body"===a.section&&a.row.index===i.length-1&&(a.cell.styles.fontStyle="bold",a.cell.styles.fillColor=[238,242,255],a.cell.styles.textColor=[55,48,163])}}),f=e.lastAutoTable.finalY+12;let j=e.internal.pageSize.getWidth(),k=j-40;return e.setFillColor(15,23,42),e.roundedRect(20,f,k,18,2,2,"F"),e.setDrawColor(16,185,129),e.setLineWidth(.4),e.line(22,f+18-1.5,20+k-2,f+18-1.5),e.setFont("helvetica","bold"),e.setFontSize(11),e.setTextColor(226,232,240),e.text("NET PAY",26,f+11),e.setFontSize(17),e.setTextColor(110,231,183),e.text((0,y.ot)(a.netPay),j-20-6,f+11.5,{align:"right"}),e.setTextColor(0,0,0),f+=28,e.setFontSize(8),e.setTextColor(100),e.text("This is a computer-generated document and does not require a signature.",105,287,{align:"center"}),e.text("For any queries regarding this payslip, please contact the HR department.",105,292,{align:"center"}),Buffer.from(e.output("arraybuffer"))}catch(a){throw console.error("Error generating payslip PDF with jsPDF:",a),a}}let E=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/payroll/[id]/payslip/route",pathname:"/api/payroll/[id]/payslip",filename:"route",bundlePath:"app/api/payroll/[id]/payslip/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"C:\\laragon\\www\\insight-books-v2.5\\app\\api\\payroll\\[id]\\payslip\\route.js",nextConfigOutput:"",userland:d,...{}}),{workAsyncStorage:F,workUnitAsyncStorage:G,serverHooks:H}=E;function I(){return(0,g.patchFetch)({workAsyncStorage:F,workUnitAsyncStorage:G})}async function J(a,b,c){c.requestMeta&&(0,h.setRequestMeta)(a,c.requestMeta),E.isDev&&(0,h.addRequestMeta)(a,"devRequestTimingInternalsEnd",process.hrtime.bigint());let d="/api/payroll/[id]/payslip/route";"/index"===d&&(d="/");let e=await E.prepare(a,b,{srcPage:d,multiZoneDraftMode:!1});if(!e)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:g,deploymentId:v,params:w,nextConfig:x,parsedUrl:y,isDraftMode:z,prerenderManifest:A,routerServerContext:B,isOnDemandRevalidate:C,revalidateOnlyGenerated:D,resolvedPathname:F,clientReferenceManifest:G,serverActionsManifest:H}=e,I=(0,k.normalizeAppPath)(d),J=!!(A.dynamicRoutes[I]||A.routes[F]),K=async()=>((null==B?void 0:B.render404)?await B.render404(a,b,y,!1):b.end("This page could not be found"),null);if(J&&!z){let a=!!A.routes[F],b=A.dynamicRoutes[I];if(b&&!1===b.fallback&&!a){if(x.adapterPath)return await K();throw new t.NoFallbackError}}let L=null;!J||E.isDev||z||(L="/index"===(L=F)?"/":L);let M=!0===E.isDev||!J,N=J&&!M;H&&G&&(0,j.setManifestsSingleton)({page:d,clientReferenceManifest:G,serverActionsManifest:H});let O=a.method||"GET",P=(0,i.getTracer)(),Q=P.getActiveScopeSpan(),R=!!(null==B?void 0:B.isWrappedByNextServer),S=!!(0,h.getRequestMeta)(a,"minimalMode"),T=(0,h.getRequestMeta)(a,"incrementalCache")||await E.getIncrementalCache(a,x,A,S);null==T||T.resetRequestCache(),globalThis.__incrementalCache=T;let U={params:w,previewProps:A.preview,renderOpts:{experimental:{authInterrupts:!!x.experimental.authInterrupts},cacheComponents:!!x.cacheComponents,supportsDynamicResponse:M,incrementalCache:T,cacheLifeProfiles:x.cacheLife,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d,e)=>E.onRequestError(a,b,d,e,B)},sharedContext:{buildId:g,deploymentId:v}},V=new l.NodeNextRequest(a),W=new l.NodeNextResponse(b),X=m.NextRequestAdapter.fromNodeNextRequest(V,(0,m.signalFromNodeResponse)(b));try{let e,g=async a=>E.handle(X,U).finally(()=>{if(!a)return;a.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let c=P.getRootSpanAttributes();if(!c)return;if(c.get("next.span_type")!==n.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${c.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let f=c.get("next.route");if(f){let b=`${O} ${f}`;a.setAttributes({"next.route":f,"http.route":f,"next.span_name":b}),a.updateName(b),e&&e!==a&&(e.setAttribute("http.route",f),e.updateName(b))}else a.updateName(`${O} ${d}`)}),h=async e=>{var h,i;let j=async({previousCacheEntry:f})=>{try{if(!S&&C&&D&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let d=await g(e);a.fetchMetrics=U.renderOpts.fetchMetrics;let h=U.renderOpts.pendingWaitUntil;h&&c.waitUntil&&(c.waitUntil(h),h=void 0);let i=U.renderOpts.collectedTags;if(!J)return await (0,p.I)(V,W,d,U.renderOpts.pendingWaitUntil),null;{let a=await d.blob(),b=(0,q.toNodeOutgoingHttpHeaders)(d.headers);i&&(b[s.NEXT_CACHE_TAGS_HEADER]=i),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==U.renderOpts.collectedRevalidate&&!(U.renderOpts.collectedRevalidate>=s.INFINITE_CACHE)&&U.renderOpts.collectedRevalidate,e=void 0===U.renderOpts.collectedExpire||U.renderOpts.collectedExpire>=s.INFINITE_CACHE?void 0:U.renderOpts.collectedExpire;return{value:{kind:u.CachedRouteKind.APP_ROUTE,status:d.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:e}}}}catch(b){throw(null==f?void 0:f.isStale)&&await E.onRequestError(a,b,{routerKind:"App Router",routePath:d,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:N,isOnDemandRevalidate:C})},!1,B),b}},k=await E.handleResponse({req:a,nextConfig:x,cacheKey:L,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:A,isRoutePPREnabled:!1,isOnDemandRevalidate:C,revalidateOnlyGenerated:D,responseGenerator:j,waitUntil:c.waitUntil,isMinimalMode:S});if(!J)return null;if((null==k||null==(h=k.value)?void 0:h.kind)!==u.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==k||null==(i=k.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});S||b.setHeader("x-nextjs-cache",C?"REVALIDATED":k.isMiss?"MISS":k.isStale?"STALE":"HIT"),z&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let l=(0,q.fromNodeOutgoingHttpHeaders)(k.value.headers);return S&&J||l.delete(s.NEXT_CACHE_TAGS_HEADER),!k.cacheControl||b.getHeader("Cache-Control")||l.get("Cache-Control")||l.set("Cache-Control",(0,r.getCacheControlHeader)(k.cacheControl)),await (0,p.I)(V,W,new Response(k.value.body,{headers:l,status:k.value.status||200})),null};R&&Q?await h(Q):(e=P.getActiveScopeSpan(),await P.withPropagatedContext(a.headers,()=>P.trace(n.BaseServerSpan.handleRequest,{spanName:`${O} ${d}`,kind:i.SpanKind.SERVER,attributes:{"http.method":O,"http.target":a.url}},h),void 0,!R))}catch(b){if(b instanceof t.NoFallbackError||await E.onRequestError(a,b,{routerKind:"App Router",routePath:I,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:N,isOnDemandRevalidate:C})},!1,B),J)throw b;return await (0,p.I)(V,W,new Response(null,{status:500})),null}}},710846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},744870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},896330:a=>{"use strict";a.exports=require("@prisma/client")},903295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},986439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")}};var b=require("../../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[64741,65573,81813,1026],()=>b(b.s=703394));module.exports=c})();