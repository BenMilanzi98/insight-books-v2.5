"use strict";(()=>{var a={};a.id=2341,a.ids=[2341],a.modules={55591:a=>{a.exports=require("https")},74075:a=>{a.exports=require("zlib")},134631:a=>{a.exports=require("tls")},181280:(a,b,c)=>{c.d(b,{F:()=>g,q:()=>f});var d=c(215220),e=c(476706);async function f(a,b=d.default){return a?(0,e.Kh)(a,b):null}async function g(a){if(!a?.tenantId)return a.primaryBranchId=null,a.currentBranchId=null,a.allowedBranchIds=null,a;let b=await f(a.tenantId);return a.primaryBranchId=b,a.currentBranchId=b,a.defaultBranchId=b,a.allowedBranchIds=null,a}},200261:a=>{a.exports=require("next/dist/shared/lib/router/utils/app-paths")},321820:a=>{a.exports=require("os")},328354:a=>{a.exports=require("util")},333873:a=>{a.exports=require("path")},377990:(a,b,c)=>{c.d(b,{U2:()=>i,Xm:()=>g});var d=c(215220),e=c(414198);async function f(){try{return await d.default.user.findMany({where:{role:{name:"Admin"},isActive:!0,isEmailVerified:!0},include:{role:!0,tenant:!0}})}catch(a){return console.error("Error fetching master admins:",a),[]}}async function g(a,b=new Date){try{let c=new Date(b);c.setHours(0,0,0,0);let e=new Date(b);e.setHours(23,59,59,999);let[f,g]=await Promise.all([d.default.sale.aggregate({where:{tenantId:a,saleDate:{gte:c,lte:e},status:"completed"},_sum:{total:!0},_count:{id:!0}}),d.default.invoice.aggregate({where:{tenantId:a,issueDate:{gte:c,lte:e},status:{in:["Paid","Pending"]}},_sum:{total:!0},_count:{id:!0}})]),h=await d.default.expense.aggregate({where:{tenantId:a,date:{gte:c,lte:e},status:{in:["Approved","Pending"]}},_sum:{amount:!0},_count:{id:!0}}),i=await d.default.expense.groupBy({by:["category"],where:{tenantId:a,date:{gte:c,lte:e},status:{in:["Approved","Pending"]}},_sum:{amount:!0},_count:{id:!0}}),j=await d.default.invoice.aggregate({where:{tenantId:a,status:"Pending"},_sum:{total:!0},_count:{id:!0}}),k=await d.default.invoice.aggregate({where:{tenantId:a,issueDate:{gte:c,lte:e},status:{in:["Paid","Pending"]}},_sum:{taxAmount:!0,total:!0}}),l=(f._sum.total||0)+(g._sum.total||0),m=h._sum.amount||0,n=l-m,o=l>0?(n/l*100).toFixed(2):0;return{date:b,sales:{pos:{amount:f._sum.total||0,count:f._count.id||0},invoices:{amount:g._sum.total||0,count:g._count.id||0},total:l},expenses:{total:m,count:h._count.id||0,byCategory:i.map(a=>({category:a.category,amount:a._sum.amount||0,count:a._count.id||0}))},profit:{net:n,margin:parseFloat(o)},outstanding:{amount:j._sum.total||0,count:j._count.id||0},tax:{collected:k._sum.taxAmount||0,totalRevenue:k._sum.total||0}}}catch(a){throw console.error("Error fetching daily financial data:",a),a}}async function h(a,b=new Date){try{var c,f;let h,i,j,k,l,m;if(!a.tenantId)return console.log(`Skipping admin ${a.email} - no tenant associated`),{success:!1,error:"No tenant associated"};let n=await d.default.tenant.findUnique({where:{id:a.tenantId}});if(!n)return console.log(`Skipping admin ${a.email} - tenant not found`),{success:!1,error:"Tenant not found"};let o=await g(a.tenantId,b),p=(c=n.name,h=a=>new Intl.NumberFormat("en-US",{style:"currency",currency:"MWK",minimumFractionDigits:2,maximumFractionDigits:2}).format(a).replace("MWK","MWK"),i=a=>new Date(a).toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"}),j=o.profit.net>=0?"#10B981":"#EF4444",k=o.profit.net>=0?"\uD83D\uDCC8":"\uD83D\uDCC9",`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Daily Financial Report - ${c}</title>
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
          <p>${c} • ${i(o.date)}</p>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <h3>Total Sales</h3>
            <div class="amount">${h(o.sales.total)}</div>
            <div class="subtitle">${o.sales.pos.count+o.sales.invoices.count} transactions</div>
          </div>
          
          <div class="summary-card">
            <h3>Total Expenses</h3>
            <div class="amount">${h(o.expenses.total)}</div>
            <div class="subtitle">${o.expenses.count} expenses</div>
          </div>
          
          <div class="summary-card">
            <h3>Net Profit</h3>
            <div class="amount" style="color: ${j}">${k} ${h(o.profit.net)}</div>
            <div class="subtitle">${o.profit.margin}% margin</div>
          </div>
          
          <div class="summary-card">
            <h3>Outstanding</h3>
            <div class="amount">${h(o.outstanding.amount)}</div>
            <div class="subtitle">${o.outstanding.count} unpaid invoices</div>
          </div>
        </div>

        <div class="section">
          <h2>📈 Sales Breakdown</h2>
          <div class="metric-row">
            <span class="metric-label">POS Sales:</span>
            <span class="metric-value">${h(o.sales.pos.amount)} (${o.sales.pos.count} transactions)</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Invoice Sales:</span>
            <span class="metric-value">${h(o.sales.invoices.amount)} (${o.sales.invoices.count} invoices)</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Total Revenue:</span>
            <span class="metric-value" style="font-size: 18px; color: #4338ca;">${h(o.sales.total)}</span>
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
              ${o.expenses.byCategory.map(a=>`
                <tr>
                  <td>${a.category}</td>
                  <td>${h(a.amount)}</td>
                  <td>${a.count}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>📋 Tax Summary</h2>
          <div class="metric-row">
            <span class="metric-label">Tax Collected:</span>
            <span class="metric-value">${h(o.tax.collected)}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">Taxable Revenue:</span>
            <span class="metric-value">${h(o.tax.totalRevenue)}</span>
          </div>
        </div>

        <div class="footer">
          <p>This report was automatically generated by InsightBooks on ${i(o.date)}</p>
          <p>\xa9 ${new Date().getFullYear()} InsightBooks. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `),q=(f=n.name,l=a=>new Intl.NumberFormat("en-US",{style:"currency",currency:"MWK",minimumFractionDigits:2,maximumFractionDigits:2}).format(a).replace("MWK","MWK"),m=a=>new Date(a).toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"}),`
DAILY FINANCIAL REPORT
${f} • ${m(o.date)}

SUMMARY:
• Total Sales: ${l(o.sales.total)}
• Total Expenses: ${l(o.expenses.total)}
• Net Profit: ${l(o.profit.net)} (${o.profit.margin}% margin)
• Outstanding Invoices: ${l(o.outstanding.amount)}

SALES BREAKDOWN:
• POS Sales: ${l(o.sales.pos.amount)} (${o.sales.pos.count} transactions)
• Invoice Sales: ${l(o.sales.invoices.amount)} (${o.sales.invoices.count} invoices)

EXPENSES BY CATEGORY:
${o.expenses.byCategory.map(a=>`• ${a.category}: ${l(a.amount)} (${a.count} items)`).join("\n")}

TAX SUMMARY:
• Tax Collected: ${l(o.tax.collected)}
• Taxable Revenue: ${l(o.tax.totalRevenue)}

---
Generated by InsightBooks on ${m(o.date)}
  `.trim()),r=await (0,e.AY)(a.email,a.name||"Master Admin",n.name,o.date,p,q);if(!r.success)return console.log(`Failed to send email to ${a.email}:`,r.error),{success:!1,adminEmail:a.email,tenantName:n.name,error:r.error,emailResult:r};return console.log(`Successfully sent email to ${a.email}`),{success:!0,adminEmail:a.email,tenantName:n.name,emailResult:r}}catch(b){return console.error(`Error sending daily report to ${a.email}:`,b),{success:!1,adminEmail:a.email,error:b.message}}}async function i(a=new Date){try{console.log(`Starting daily report processing for ${a.toDateString()}`);let b=await f();if(0===b.length)return console.log("No master admins found"),{success:!1,error:"No master admins found"};console.log(`Found ${b.length} master admin(s)`);let c=[];for(let d of b){console.log(`Processing report for admin: ${d.email}`);let b=await h(d,a);c.push(b),await new Promise(a=>setTimeout(a,1e3))}let d=c.filter(a=>a.success).length,e=c.filter(a=>!a.success).length;return console.log(`Daily report processing completed: ${d} successful, ${e} failed`),{success:!0,totalAdmins:b.length,successful:d,failed:e,results:c}}catch(a){return console.error("Error processing daily reports:",a),{success:!1,error:a.message}}}},379551:a=>{a.exports=require("url")},455511:a=>{a.exports=require("crypto")},476706:(a,b,c)=>{c.d(b,{Kh:()=>f,Pz:()=>e});var d=c(215220);async function e(a,b){if(!a?.id||!b)return!1;if(a.role?.name==="MASTER_ADMIN")return!!await d.default.tenant.findUnique({where:{id:b},select:{id:!0}});if(a.tenantId===b||await d.default.tenant.findFirst({where:{id:b,ownerUserId:a.id},select:{id:!0}}))return!0;let[c,e]=await Promise.all([d.default.tenantMembership.findFirst({where:{userId:a.id,tenantId:b,status:{equals:"active",mode:"insensitive"}},select:{id:!0}}),d.default.user.findUnique({where:{id:a.id},select:{tenants:{where:{id:b},select:{id:!0}}}})]);return!!c||(e?.tenants?.length??0)>0}async function f(a,b=d.default){if(!a)return null;let c=await b.tenant.findUnique({where:{id:a},select:{id:!0,name:!0}});if(!c)return null;let e=await b.branch.findFirst({where:{tenantId:a},orderBy:{createdAt:"asc"},select:{id:!0,isActive:!0}});if(e)return e.isActive||await b.branch.update({where:{id:e.id},data:{isActive:!0}}),await b.tenant.update({where:{id:a},data:{defaultBranchId:e.id}}),e.id;let g=c.name?`${c.name} — stock`:"Main location",h=g.length>120?g.slice(0,120):g,i=await b.branch.create({data:{tenantId:a,name:h,isActive:!0},select:{id:!0}});return await b.tenant.update({where:{id:a},data:{defaultBranchId:i.id}}),i.id}},491645:a=>{a.exports=require("net")},529294:a=>{a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},579646:a=>{a.exports=require("child_process")},594735:a=>{a.exports=require("events")},629021:a=>{a.exports=require("fs")},663033:a=>{a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},710846:a=>{a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},714985:a=>{a.exports=require("dns")},744870:a=>{a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},781630:a=>{a.exports=require("http")},896330:a=>{a.exports=require("@prisma/client")},903295:a=>{a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},927910:a=>{a.exports=require("stream")},932536:(a,b,c)=>{c.r(b),c.d(b,{handler:()=>F,patchFetch:()=>E,routeModule:()=>A,serverHooks:()=>D,workAsyncStorage:()=>B,workUnitAsyncStorage:()=>C});var d={};c.r(d),c.d(d,{GET:()=>z,POST:()=>y});var e=c(319225),f=c(684006),g=c(8317),h=c(799373),i=c(434775),j=c(524235),k=c(200261),l=c(754365),m=c(590771),n=c(473461),o=c(767798),p=c(192280),q=c(662018),r=c(445696),s=c(347929),t=c(986439),u=c(137527),v=c(945592),w=c(701026),x=c(377990);async function y(a){try{let b=await (0,w.Ux)(a);if(!b)return v.NextResponse.json({error:"Authentication required"},{status:401});if(!b.role||"Admin"!==b.role.name)return v.NextResponse.json({error:"Super Admin access required"},{status:403});let c=new Date,d=!1;try{let b=await a.json();if(b.date&&(c=new Date(b.date),isNaN(c.getTime())))return v.NextResponse.json({error:"Invalid date format"},{status:400});d=b.testMode||!1}catch(a){console.log("No request body provided, using current date")}if(console.log(`Manual daily report test triggered by ${b.email} for date: ${c.toISOString()}`),d){if(!b.tenantId)return v.NextResponse.json({error:"No tenant associated with user"},{status:400});let a=await (0,x.Xm)(b.tenantId,c);return v.NextResponse.json({success:!0,message:"Test mode: Financial data retrieved successfully",data:a,timestamp:new Date().toISOString(),reportDate:c.toISOString()})}let e=await (0,x.U2)(c);if(!e.success)return console.error("Daily report processing failed:",e.error),v.NextResponse.json({success:!1,error:e.error,timestamp:new Date().toISOString()},{status:500});return console.log("Manual daily report test completed successfully:",{triggeredBy:b.email,totalAdmins:e.totalAdmins,successful:e.successful,failed:e.failed,timestamp:new Date().toISOString()}),v.NextResponse.json({success:!0,message:"Daily reports processed successfully",summary:{totalAdmins:e.totalAdmins,successful:e.successful,failed:e.failed},triggeredBy:b.email,timestamp:new Date().toISOString(),reportDate:c.toISOString()})}catch(a){return console.error("Error in manual daily report test:",a),v.NextResponse.json({success:!1,error:"Internal server error",details:a.message,timestamp:new Date().toISOString()},{status:500})}}async function z(a){try{let b=await (0,w.Ux)(a);if(!b)return v.NextResponse.json({error:"Authentication required"},{status:401});if(!b.role||"Admin"!==b.role.name)return v.NextResponse.json({error:"Super Admin access required"},{status:403});if(!b.tenantId)return v.NextResponse.json({error:"No tenant associated with user"},{status:400});let{searchParams:c}=new URL(a.url),d=c.get("date"),e=new Date;if(d&&(e=new Date(d),isNaN(e.getTime())))return v.NextResponse.json({error:"Invalid date format"},{status:400});console.log(`Daily report data requested by ${b.email} for date: ${e.toISOString()}`);let f=await (0,x.Xm)(b.tenantId,e);return v.NextResponse.json({success:!0,message:"Daily report data retrieved successfully",data:f,tenantId:b.tenantId,requestedBy:b.email,timestamp:new Date().toISOString(),reportDate:e.toISOString()})}catch(a){return console.error("Error retrieving daily report data:",a),v.NextResponse.json({success:!1,error:"Internal server error",details:a.message,timestamp:new Date().toISOString()},{status:500})}}let A=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/admin/test-daily-report/route",pathname:"/api/admin/test-daily-report",filename:"route",bundlePath:"app/api/admin/test-daily-report/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"C:\\laragon\\www\\insight-books-v2.5\\app\\api\\admin\\test-daily-report\\route.js",nextConfigOutput:"",userland:d,...{}}),{workAsyncStorage:B,workUnitAsyncStorage:C,serverHooks:D}=A;function E(){return(0,g.patchFetch)({workAsyncStorage:B,workUnitAsyncStorage:C})}async function F(a,b,c){c.requestMeta&&(0,h.setRequestMeta)(a,c.requestMeta),A.isDev&&(0,h.addRequestMeta)(a,"devRequestTimingInternalsEnd",process.hrtime.bigint());let d="/api/admin/test-daily-report/route";"/index"===d&&(d="/");let e=await A.prepare(a,b,{srcPage:d,multiZoneDraftMode:!1});if(!e)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:g,deploymentId:v,params:w,nextConfig:x,parsedUrl:y,isDraftMode:z,prerenderManifest:B,routerServerContext:C,isOnDemandRevalidate:D,revalidateOnlyGenerated:E,resolvedPathname:F,clientReferenceManifest:G,serverActionsManifest:H}=e,I=(0,k.normalizeAppPath)(d),J=!!(B.dynamicRoutes[I]||B.routes[F]),K=async()=>((null==C?void 0:C.render404)?await C.render404(a,b,y,!1):b.end("This page could not be found"),null);if(J&&!z){let a=!!B.routes[F],b=B.dynamicRoutes[I];if(b&&!1===b.fallback&&!a){if(x.adapterPath)return await K();throw new t.NoFallbackError}}let L=null;!J||A.isDev||z||(L="/index"===(L=F)?"/":L);let M=!0===A.isDev||!J,N=J&&!M;H&&G&&(0,j.setManifestsSingleton)({page:d,clientReferenceManifest:G,serverActionsManifest:H});let O=a.method||"GET",P=(0,i.getTracer)(),Q=P.getActiveScopeSpan(),R=!!(null==C?void 0:C.isWrappedByNextServer),S=!!(0,h.getRequestMeta)(a,"minimalMode"),T=(0,h.getRequestMeta)(a,"incrementalCache")||await A.getIncrementalCache(a,x,B,S);null==T||T.resetRequestCache(),globalThis.__incrementalCache=T;let U={params:w,previewProps:B.preview,renderOpts:{experimental:{authInterrupts:!!x.experimental.authInterrupts},cacheComponents:!!x.cacheComponents,supportsDynamicResponse:M,incrementalCache:T,cacheLifeProfiles:x.cacheLife,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d,e)=>A.onRequestError(a,b,d,e,C)},sharedContext:{buildId:g,deploymentId:v}},V=new l.NodeNextRequest(a),W=new l.NodeNextResponse(b),X=m.NextRequestAdapter.fromNodeNextRequest(V,(0,m.signalFromNodeResponse)(b));try{let e,g=async a=>A.handle(X,U).finally(()=>{if(!a)return;a.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let c=P.getRootSpanAttributes();if(!c)return;if(c.get("next.span_type")!==n.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${c.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let f=c.get("next.route");if(f){let b=`${O} ${f}`;a.setAttributes({"next.route":f,"http.route":f,"next.span_name":b}),a.updateName(b),e&&e!==a&&(e.setAttribute("http.route",f),e.updateName(b))}else a.updateName(`${O} ${d}`)}),h=async e=>{var h,i;let j=async({previousCacheEntry:f})=>{try{if(!S&&D&&E&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let d=await g(e);a.fetchMetrics=U.renderOpts.fetchMetrics;let h=U.renderOpts.pendingWaitUntil;h&&c.waitUntil&&(c.waitUntil(h),h=void 0);let i=U.renderOpts.collectedTags;if(!J)return await (0,p.I)(V,W,d,U.renderOpts.pendingWaitUntil),null;{let a=await d.blob(),b=(0,q.toNodeOutgoingHttpHeaders)(d.headers);i&&(b[s.NEXT_CACHE_TAGS_HEADER]=i),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==U.renderOpts.collectedRevalidate&&!(U.renderOpts.collectedRevalidate>=s.INFINITE_CACHE)&&U.renderOpts.collectedRevalidate,e=void 0===U.renderOpts.collectedExpire||U.renderOpts.collectedExpire>=s.INFINITE_CACHE?void 0:U.renderOpts.collectedExpire;return{value:{kind:u.CachedRouteKind.APP_ROUTE,status:d.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:e}}}}catch(b){throw(null==f?void 0:f.isStale)&&await A.onRequestError(a,b,{routerKind:"App Router",routePath:d,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:N,isOnDemandRevalidate:D})},!1,C),b}},k=await A.handleResponse({req:a,nextConfig:x,cacheKey:L,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:B,isRoutePPREnabled:!1,isOnDemandRevalidate:D,revalidateOnlyGenerated:E,responseGenerator:j,waitUntil:c.waitUntil,isMinimalMode:S});if(!J)return null;if((null==k||null==(h=k.value)?void 0:h.kind)!==u.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==k||null==(i=k.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});S||b.setHeader("x-nextjs-cache",D?"REVALIDATED":k.isMiss?"MISS":k.isStale?"STALE":"HIT"),z&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let l=(0,q.fromNodeOutgoingHttpHeaders)(k.value.headers);return S&&J||l.delete(s.NEXT_CACHE_TAGS_HEADER),!k.cacheControl||b.getHeader("Cache-Control")||l.get("Cache-Control")||l.set("Cache-Control",(0,r.getCacheControlHeader)(k.cacheControl)),await (0,p.I)(V,W,new Response(k.value.body,{headers:l,status:k.value.status||200})),null};R&&Q?await h(Q):(e=P.getActiveScopeSpan(),await P.withPropagatedContext(a.headers,()=>P.trace(n.BaseServerSpan.handleRequest,{spanName:`${O} ${d}`,kind:i.SpanKind.SERVER,attributes:{"http.method":O,"http.target":a.url}},h),void 0,!R))}catch(b){if(b instanceof t.NoFallbackError||await A.onRequestError(a,b,{routerKind:"App Router",routePath:I,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:N,isOnDemandRevalidate:D})},!1,C),J)throw b;return await (0,p.I)(V,W,new Response(null,{status:500})),null}}},986439:a=>{a.exports=require("next/dist/shared/lib/no-fallback-error.external")}};var b=require("../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[64741,81813,65573,35924,1026,13177],()=>b(b.s=932536));module.exports=c})();