(()=>{var a={};a.id=83448,a.ids=[83448],a.modules={78335:()=>{},200261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},296487:()=>{},529294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},663033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},692336:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>C,patchFetch:()=>B,routeModule:()=>x,serverHooks:()=>A,workAsyncStorage:()=>y,workUnitAsyncStorage:()=>z});var d={};c.r(d),c.d(d,{POST:()=>w});var e=c(319225),f=c(684006),g=c(8317),h=c(799373),i=c(434775),j=c(524235),k=c(200261),l=c(754365),m=c(590771),n=c(473461),o=c(767798),p=c(192280),q=c(662018),r=c(445696),s=c(347929),t=c(986439),u=c(137527),v=c(945592);async function w(a){try{var b;let{messages:c}=await a.json();if(!c||!Array.isArray(c))return v.NextResponse.json({error:"Invalid request format"},{status:400});let d=(b=c[c.length-1]?.content?.toLowerCase()||"").includes("invoice")||b.includes("bill")?`To manage invoices in InsightBooks:

1. **Create an Invoice:**
   - Navigate to "Invoicing" from the sidebar
   - Click "Create Invoice" or "New Invoice"
   - Fill in client details, items, and amounts
   - Save and send

2. **View Invoices:**
   - Go to the Invoicing page to see all invoices
   - Filter by status (Draft, Sent, Paid, Overdue)
   - Use date range filters for specific periods

3. **Send Invoice:**
   - Open an invoice
   - Click "Send Invoice" to email it to the client

4. **Mark as Paid:**
   - Open a paid invoice
   - Click "Mark as Paid" and record payment details

Need help with a specific invoice task? Let me know!`:b.includes("expense")||b.includes("spend")?`To track expenses in InsightBooks:

1. **Record an Expense:**
   - Go to "Expense Tracking" from the sidebar
   - Click "Add Expense" or "New Expense"
   - Enter amount, category, date, and description
   - Attach receipts if needed
   - Save

2. **Expense Categories:**
   - Expenses are organized by categories
   - You can create custom categories in settings
   - Common categories: Office Supplies, Utilities, Travel, etc.

3. **View Expenses:**
   - Use the Expense Tracking page to see all expenses
   - Filter by date range, category, or status
   - Export expense reports for accounting

4. **Recurring Expenses:**
   - Set up recurring expenses for regular bills
   - Automatically creates expense entries on schedule

Would you like help with a specific expense feature?`:b.includes("user")||b.includes("role")||b.includes("permission")?`To manage users and roles in InsightBooks:

1. **User Management:**
   - Navigate to "User & Role Management"
   - Click "Add User" to create new users
   - Edit user details, roles, and permissions
   - Deactivate or delete users as needed

2. **Role Management:**
   - Roles define what users can do in the system
   - Common roles: Admin, Manager, Accountant, Sales Staff
   - Each role has specific permissions

3. **Permissions:**
   - Permissions control access to features
   - Examples: invoices.view, expenses.create, reports.export
   - Assign permissions to roles, not individual users

4. **Best Practices:**
   - Create roles first, then assign users to roles
   - Use principle of least privilege
   - Regularly review user access

Need help setting up a specific role or permission?`:b.includes("stock")||b.includes("inventory")||b.includes("product")?`To manage inventory in InsightBooks:

1. **Add Products:**
   - Go to "Stock Management"
   - Click "Add Product" or "New Item"
   - Enter product details: name, SKU, price, quantity
   - Set low stock alerts
   - Save

2. **Stock Alerts:**
   - System alerts when stock is low
   - View alerts on the dashboard
   - Click "Restock" to create purchase orders

3. **Stock Movements:**
   - Track all stock transactions
   - View stock history and adjustments
   - Export stock reports

4. **Inventory Valuation:**
   - View current inventory value
   - Generate inventory reports
   - Track stock by location (if multi-location)

5. **Suppliers:**
   - Manage supplier information
   - Link products to suppliers
   - Create purchase orders

Need help with a specific inventory task?`:b.includes("report")||b.includes("analytics")||b.includes("data")?`InsightBooks offers comprehensive reporting:

1. **Financial Reports:**
   - Income Statement (Profit & Loss)
   - Balance Sheet
   - Cash Flow Statement
   - Trial Balance
   - Available in "Financial Reporting"

2. **Sales Reports:**
   - Sales analysis by period
   - Product sales performance
   - Customer sales reports
   - Available in Reports section

3. **Expense Reports:**
   - Expense breakdown by category
   - Expense trends over time
   - Tax-deductible expenses
   - Available in Expense Tracking

4. **Inventory Reports:**
   - Stock valuation
   - Stock movement history
   - Low stock alerts
   - Available in Stock Management

5. **Custom Reports:**
   - Use date range filters
   - Export to Excel/PDF
   - Schedule regular reports

Which report would you like help with?`:b.includes("dashboard")||b.includes("overview")?`The InsightBooks Dashboard provides:

1. **Today's Performance:**
   - Today's revenue vs yesterday
   - Today's expenses vs yesterday
   - Weekly trend indicators

2. **Financial Summary:**
   - Total revenue for selected period
   - Total expenses for selected period
   - Change percentages

3. **Charts & Visualizations:**
   - Income & Expense bar chart
   - Expense breakdown pie chart
   - Accounts receivable overview
   - Accounts payable overview

4. **Quick Actions:**
   - Stock alerts
   - Recent transactions
   - Upcoming payments

5. **Date Range Filter:**
   - Filter dashboard data by date range
   - Compare different periods
   - Export dashboard data

The dashboard updates automatically as you add transactions. Need help with a specific metric?`:b.includes("help")||b.includes("how")||b.includes("what")?`I'm here to help you with InsightBooks! I can assist with:

✅ **Feature Guidance** - How to use specific features
✅ **Troubleshooting** - Resolve common issues
✅ **Best Practices** - Tips for efficient system use
✅ **Navigation** - Help finding features
✅ **Configuration** - Setting up system options
✅ **Reports** - Understanding your data

**Quick Tips:**
- Use the sidebar to navigate between sections
- Most pages have search and filter options
- Export features are available in most sections
- Use date range filters for time-specific data

What specific area would you like help with? You can ask about:
- Invoicing and payments
- Expense tracking
- Inventory management
- User and role management
- Reports and analytics
- Or anything else about InsightBooks!`:`I understand you're asking about "${b}". 

I can help you with various InsightBooks features including:
- User & Role Management
- Financial Operations (Invoices, Expenses, Payments)
- Inventory & Stock Management
- Reports & Analytics
- System Configuration

Could you be more specific about what you need help with? For example:
- "How do I create an invoice?"
- "How do I add a new user?"
- "How do I view my expenses?"
- "How do I check stock levels?"

Or ask me about any other InsightBooks feature!`;return v.NextResponse.json({response:d})}catch(a){return console.error("AI Assistant error:",a),v.NextResponse.json({error:"Failed to process request",response:"I'm sorry, I encountered an error processing your request. Please try again or contact support."},{status:500})}}let x=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/ai-assistant/chat/route",pathname:"/api/ai-assistant/chat",filename:"route",bundlePath:"app/api/ai-assistant/chat/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"C:\\laragon\\www\\insight-books-v2.5\\app\\api\\ai-assistant\\chat\\route.js",nextConfigOutput:"",userland:d,...{}}),{workAsyncStorage:y,workUnitAsyncStorage:z,serverHooks:A}=x;function B(){return(0,g.patchFetch)({workAsyncStorage:y,workUnitAsyncStorage:z})}async function C(a,b,c){c.requestMeta&&(0,h.setRequestMeta)(a,c.requestMeta),x.isDev&&(0,h.addRequestMeta)(a,"devRequestTimingInternalsEnd",process.hrtime.bigint());let d="/api/ai-assistant/chat/route";"/index"===d&&(d="/");let e=await x.prepare(a,b,{srcPage:d,multiZoneDraftMode:!1});if(!e)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:g,deploymentId:v,params:w,nextConfig:y,parsedUrl:z,isDraftMode:A,prerenderManifest:B,routerServerContext:C,isOnDemandRevalidate:D,revalidateOnlyGenerated:E,resolvedPathname:F,clientReferenceManifest:G,serverActionsManifest:H}=e,I=(0,k.normalizeAppPath)(d),J=!!(B.dynamicRoutes[I]||B.routes[F]),K=async()=>((null==C?void 0:C.render404)?await C.render404(a,b,z,!1):b.end("This page could not be found"),null);if(J&&!A){let a=!!B.routes[F],b=B.dynamicRoutes[I];if(b&&!1===b.fallback&&!a){if(y.adapterPath)return await K();throw new t.NoFallbackError}}let L=null;!J||x.isDev||A||(L="/index"===(L=F)?"/":L);let M=!0===x.isDev||!J,N=J&&!M;H&&G&&(0,j.setManifestsSingleton)({page:d,clientReferenceManifest:G,serverActionsManifest:H});let O=a.method||"GET",P=(0,i.getTracer)(),Q=P.getActiveScopeSpan(),R=!!(null==C?void 0:C.isWrappedByNextServer),S=!!(0,h.getRequestMeta)(a,"minimalMode"),T=(0,h.getRequestMeta)(a,"incrementalCache")||await x.getIncrementalCache(a,y,B,S);null==T||T.resetRequestCache(),globalThis.__incrementalCache=T;let U={params:w,previewProps:B.preview,renderOpts:{experimental:{authInterrupts:!!y.experimental.authInterrupts},cacheComponents:!!y.cacheComponents,supportsDynamicResponse:M,incrementalCache:T,cacheLifeProfiles:y.cacheLife,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d,e)=>x.onRequestError(a,b,d,e,C)},sharedContext:{buildId:g,deploymentId:v}},V=new l.NodeNextRequest(a),W=new l.NodeNextResponse(b),X=m.NextRequestAdapter.fromNodeNextRequest(V,(0,m.signalFromNodeResponse)(b));try{let e,g=async a=>x.handle(X,U).finally(()=>{if(!a)return;a.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let c=P.getRootSpanAttributes();if(!c)return;if(c.get("next.span_type")!==n.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${c.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let f=c.get("next.route");if(f){let b=`${O} ${f}`;a.setAttributes({"next.route":f,"http.route":f,"next.span_name":b}),a.updateName(b),e&&e!==a&&(e.setAttribute("http.route",f),e.updateName(b))}else a.updateName(`${O} ${d}`)}),h=async e=>{var h,i;let j=async({previousCacheEntry:f})=>{try{if(!S&&D&&E&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let d=await g(e);a.fetchMetrics=U.renderOpts.fetchMetrics;let h=U.renderOpts.pendingWaitUntil;h&&c.waitUntil&&(c.waitUntil(h),h=void 0);let i=U.renderOpts.collectedTags;if(!J)return await (0,p.I)(V,W,d,U.renderOpts.pendingWaitUntil),null;{let a=await d.blob(),b=(0,q.toNodeOutgoingHttpHeaders)(d.headers);i&&(b[s.NEXT_CACHE_TAGS_HEADER]=i),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==U.renderOpts.collectedRevalidate&&!(U.renderOpts.collectedRevalidate>=s.INFINITE_CACHE)&&U.renderOpts.collectedRevalidate,e=void 0===U.renderOpts.collectedExpire||U.renderOpts.collectedExpire>=s.INFINITE_CACHE?void 0:U.renderOpts.collectedExpire;return{value:{kind:u.CachedRouteKind.APP_ROUTE,status:d.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:e}}}}catch(b){throw(null==f?void 0:f.isStale)&&await x.onRequestError(a,b,{routerKind:"App Router",routePath:d,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:N,isOnDemandRevalidate:D})},!1,C),b}},k=await x.handleResponse({req:a,nextConfig:y,cacheKey:L,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:B,isRoutePPREnabled:!1,isOnDemandRevalidate:D,revalidateOnlyGenerated:E,responseGenerator:j,waitUntil:c.waitUntil,isMinimalMode:S});if(!J)return null;if((null==k||null==(h=k.value)?void 0:h.kind)!==u.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==k||null==(i=k.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});S||b.setHeader("x-nextjs-cache",D?"REVALIDATED":k.isMiss?"MISS":k.isStale?"STALE":"HIT"),A&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let l=(0,q.fromNodeOutgoingHttpHeaders)(k.value.headers);return S&&J||l.delete(s.NEXT_CACHE_TAGS_HEADER),!k.cacheControl||b.getHeader("Cache-Control")||l.get("Cache-Control")||l.set("Cache-Control",(0,r.getCacheControlHeader)(k.cacheControl)),await (0,p.I)(V,W,new Response(k.value.body,{headers:l,status:k.value.status||200})),null};R&&Q?await h(Q):(e=P.getActiveScopeSpan(),await P.withPropagatedContext(a.headers,()=>P.trace(n.BaseServerSpan.handleRequest,{spanName:`${O} ${d}`,kind:i.SpanKind.SERVER,attributes:{"http.method":O,"http.target":a.url}},h),void 0,!R))}catch(b){if(b instanceof t.NoFallbackError||await x.onRequestError(a,b,{routerKind:"App Router",routePath:I,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:N,isOnDemandRevalidate:D})},!1,C),J)throw b;return await (0,p.I)(V,W,new Response(null,{status:500})),null}}},710846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},744870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},903295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},986439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")}};var b=require("../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[64741,81813],()=>b(b.s=692336));module.exports=c})();