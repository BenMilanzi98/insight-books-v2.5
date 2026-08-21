(()=>{var a={};a.id=77785,a.ids=[77785],a.modules={12014:(a,b,c)=>{"use strict";c.d(b,{$w:()=>m,Ai:()=>j,By:()=>k,M9:()=>p,NH:()=>e,Rg:()=>i,TI:()=>d,Wj:()=>g,Zx:()=>n,a3:()=>t,g7:()=>h,iG:()=>q,jB:()=>o,jz:()=>u,mf:()=>f,qy:()=>l});let d=100,e=.005,f=.01;function g(a,b=f){return Math.abs(k(a))>=b}function h(a){if(null==a||""===a)return 0;if("number"==typeof a)return Number.isFinite(a)?a:0;if("object"==typeof a&&"function"==typeof a.toNumber){let b=a.toNumber();return Number.isFinite(b)?b:0}let b=String(a).replace(/,/g,"").trim();if(!b)return 0;let c=Number(b);return Number.isFinite(c)?c:0}function i(a){let b=h(a);return(b<0?-1:1)*Math.round(Math.abs(b)*d+1e-8)}function j(a){let b=Number(a);return Number.isFinite(b)?b/d:0}function k(a){return j(i(a))}function l(...a){let b=0;for(let c of a)b+=i(c);return j(b)}function m(a,b){return j(i(a)-i(b))}function n(a,b){return j(Math.round(i(a)*i(b)/d))}function o(a,b){return j(Math.round(i(a)*h(b)/100))}function p(a){return Array.isArray(a)?l(...a):0}function q(a,b=0,c=1/0){return j(Math.min(Math.max(i(a),i(b)),i(c===1/0?1e15:c)))}function r(a,b){let c=i(a)-i(b);return c<0?-1:+(c>0)}function s(a,b,c=e){return Math.abs(m(a,b))<=c}function t(a,b,c=e){return r(a,b)>=0||s(a,b,c)}function u(a,b,c=e){return 0>=r(a,b)||s(a,b,c)}},55591:a=>{"use strict";a.exports=require("https")},74075:a=>{"use strict";a.exports=require("zlib")},78335:()=>{},79748:a=>{"use strict";a.exports=require("fs/promises")},134631:a=>{"use strict";a.exports=require("tls")},176760:a=>{"use strict";a.exports=require("node:path")},181280:(a,b,c)=>{"use strict";c.d(b,{F:()=>g,q:()=>f});var d=c(215220),e=c(476706);async function f(a,b=d.default){return a?(0,e.Kh)(a,b):null}async function g(a){if(!a?.tenantId)return a.primaryBranchId=null,a.currentBranchId=null,a.allowedBranchIds=null,a;let b=await f(a.tenantId);return a.primaryBranchId=b,a.currentBranchId=b,a.defaultBranchId=b,a.allowedBranchIds=null,a}},200261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},215220:(a,b,c)=>{"use strict";c.r(b),c.d(b,{default:()=>g,prisma:()=>f});var d=c(896330);let e=global,f=(e.prisma,e.prisma||(e.prisma=new d.PrismaClient({log:["error"]})),e.prisma),g=f},281032:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>N,patchFetch:()=>M,routeModule:()=>I,serverHooks:()=>L,workAsyncStorage:()=>J,workUnitAsyncStorage:()=>K});var d={};c.r(d),c.d(d,{POST:()=>H});var e=c(319225),f=c(684006),g=c(8317),h=c(799373),i=c(434775),j=c(524235),k=c(200261),l=c(754365),m=c(590771),n=c(473461),o=c(767798),p=c(192280),q=c(662018),r=c(445696),s=c(347929),t=c(986439),u=c(137527),v=c(945592),w=c(215220),x=c(701026),y=c(332863),z=c(12014),A=c(390780),B=c(822480),C=c(290086),D=c(629021),E=c.n(D),F=c(235924);function G(a){return null==a||void 0===a?"":String(a).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}async function H(a,b){try{let{id:c}=await b.params,d=await (0,x.Ux)(a);if(!d)return v.NextResponse.json({error:"Authentication required"},{status:401});let e=await w.default.invoice.findUnique({where:{id:c,tenantId:d.tenantId},include:{client:!0,items:!0,createdBy:{select:{id:!0,name:!0,email:!0}}}});if(!e)return v.NextResponse.json({error:"Invoice not found"},{status:404});let f=a.headers.get("content-type")||"",g="",h=null,i=[],j=[];if(f.includes("multipart/form-data")){let b=await a.formData();g=(b.get("message")??"").toString();let c=b.get("templateId");h=null!=c&&""!==c?c.toString():null;let d=b.get("otherEmails");if(null!=d&&"string"==typeof d)try{let a=JSON.parse(d);j=Array.isArray(a)?a.filter(a=>a&&"string"==typeof a):[]}catch(a){}for(let[a,c]of b.entries())"attachments"===a&&null!=c&&"function"==typeof c.arrayBuffer&&i.push(c)}else{let b=await a.json().catch(()=>({}));g=b?.message||"",h=b?.templateId;let c=b?.otherEmails;j=Array.isArray(c)?c.filter(a=>a&&"string"==typeof a):[]}let k=new Set,l=[];if(e.client.email){let a=e.client.email.trim().toLowerCase();a&&!k.has(a)&&(k.add(a),l.push(e.client.email))}if(e.client.additionalEmails&&e.client.additionalEmails.length>0)for(let a of e.client.additionalEmails){let b=(a||"").trim().toLowerCase();b&&!k.has(b)&&(k.add(b),l.push(a))}for(let a of j){let b=(a||"").trim().toLowerCase();b&&!k.has(b)&&(k.add(b),l.push(a.trim()))}if(0===l.length)return v.NextResponse.json({error:"Client does not have an email address"},{status:400});let m=await w.default.tenant.findUnique({where:{id:d.tenantId},include:{settings:!0}}),n=null;h&&(n=await w.default.invoiceTemplate.findUnique({where:{id:h}})),n||(n=await w.default.invoiceTemplate.findFirst({where:{OR:[{tenantId:d.tenantId,isDefault:!0},{tenantId:d.tenantId}]},orderBy:{isDefault:"desc"}}));let o="Paid"===e.status,p=function(a,b,c=!1){let d=b?.primaryColor||"#4338ca",e=b?.logoUrl;if(e&&e.startsWith("/")){let a=process.env.NEXT_PUBLIC_BASE_URL||"";e=`${a}${e}`}let f=(0,A.Vr)(a.items),g=(0,A.ME)({taxAmount:a.taxAmount,taxLines:(a.items||[]).flatMap(a=>a.itemTaxes||[])}),h=a.items.map(a=>{let b=(0,z.Zx)(a.quantity,a.unitPrice),c=Number(a.taxRate)||0,d=(0,z.jB)(b,c),e=c>0?`Tax (${c}%): ${(0,y.vv)(d)}`:"—",g=G(a.description&&String(a.description).trim()||"Item");return`
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${g}</td>
        <td style="padding: 10px; text-align: center;">${a.quantity}</td>
        <td style="padding: 10px; text-align: right;">${(0,y.vv)(a.unitPrice)}</td>
        ${f?`<td style="padding: 10px; text-align: right; font-size: 11px; color: #4b5563;">${e}</td>`:""}
        <td style="padding: 10px; text-align: right;">${(0,y.vv)(b)}</td>
      </tr>
    `}).join("");return`
    <div style="font-family: Arial, sans-serif; margin: 20px 0; border: 1px solid #e0e0e0; border-radius: 5px; overflow: hidden;">
      <!-- Header -->
      <div style="background-color: ${d}; padding: 20px; color: white;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <h1 style="margin: 0; font-size: 24px;">${c?"PAYMENT CONFIRMATION":"INVOICE"}</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">#${G(a.invoiceNumber)}</p>
            </td>
            <td style="text-align: right;">
              ${e?`<img src="${G(e)}" alt="${G(b?.name||"Company")}" style="max-height: 80px; background: white; padding: 8px; border-radius: 6px;">`:`<h2 style="margin: 0; color: white;">${G(b?.name||"InsightBooks")}</h2>`}
            </td>
          </tr>
        </table>
      </div>
      
      <!-- Client and Invoice Info -->
      <div style="padding: 20px; background-color: #f9fafb;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width: 50%; vertical-align: top;">
              <h3 style="color: #6b7280; margin-top: 0; margin-bottom: 10px; font-size: 14px; text-transform: uppercase;">Bill To:</h3>
              <p style="margin: 0 0 5px 0; font-weight: bold;">${G(a.client.name)}</p>
              ${a.client.contactPerson?`<p style="margin: 0 0 5px 0;">Attn: ${G(a.client.contactPerson)}</p>`:""}
              ${a.client.address?`<p style="margin: 0 0 5px 0;">${G(a.client.address)}</p>`:""}
              <p style="margin: 0 0 5px 0;">${G(a.client.email)}</p>
              ${a.client.phone?`<p style="margin: 0 0 5px 0;">Phone: ${G(a.client.phone)}</p>`:""}
            </td>
            <td style="width: 50%; vertical-align: top;">
              <h3 style="color: #6b7280; margin-top: 0; margin-bottom: 10px; font-size: 14px; text-transform: uppercase;">Invoice Details:</h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom: 5px;"><strong>Issue Date:</strong></td>
                  <td style="padding-bottom: 5px; text-align: right;">${(0,y.Yq)(a.issueDate)}</td>
                </tr>
                <tr>
                  <td style="padding-bottom: 5px;"><strong>Due Date:</strong></td>
                  <td style="padding-bottom: 5px; text-align: right;">${(0,y.Yq)(a.dueDate)}</td>
                </tr>
                <tr>
                  <td style="padding-bottom: 5px;"><strong>Status:</strong></td>
                  <td style="padding-bottom: 5px; text-align: right;">
                    <span style="display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 12px; background-color: ${"Paid"===a.status?"#d1fae5":"Pending"===a.status?"#fef3c7":"Overdue"===a.status?"#fee2e2":"#f3f4f6"}; color: ${"Paid"===a.status?"#065f46":"Pending"===a.status?"#92400e":"Overdue"===a.status?"#b91c1c":"#374151"};">
                      ${G(a.status)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
      
      <!-- Invoice Items -->
      <div style="padding: 0 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Description</th>
              <th style="padding: 10px; text-align: center; font-size: 12px; text-transform: uppercase; color: #6b7280;">Qty</th>
              <th style="padding: 10px; text-align: right; font-size: 12px; text-transform: uppercase; color: #6b7280;">Rate</th>
              ${f?'<th style="padding: 10px; text-align: center; font-size: 12px; text-transform: uppercase; color: #6b7280;">Tax</th>':""}
              <th style="padding: 10px; text-align: right; font-size: 12px; text-transform: uppercase; color: #6b7280;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${h}
          </tbody>
        </table>
      </div>
      
      <!-- Totals -->
      <div style="padding: 0 20px 20px; text-align: right;">
        <table width="250" cellpadding="0" cellspacing="0" style="margin-left: auto;">
          <tr>
            <td style="padding: 5px 0;"><span style="color: #6b7280;">Subtotal:</span></td>
            <td style="padding: 5px 0; text-align: right;">${(0,y.vv)(a.subtotal)}</td>
          </tr>
          ${g?`
          <tr>
            <td style="padding: 5px 0;"><span style="color: #6b7280;">Tax:</span></td>
            <td style="padding: 5px 0; text-align: right;">${(0,y.vv)(a.taxAmount)}</td>
          </tr>`:""}
          <tr style="border-top: 2px solid #e5e7eb;">
            <td style="padding: 10px 0; font-weight: bold; font-size: 18px; color: ${d};">Total:</td>
            <td style="padding: 10px 0; font-weight: bold; font-size: 18px; text-align: right; color: ${d};">${(0,y.vv)(a.total)}</td>
          </tr>
        </table>
      </div>
      
      <!-- Notes -->
      <div style="padding: 20px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
        <h3 style="color: #6b7280; margin-top: 0; margin-bottom: 10px; font-size: 14px; text-transform: uppercase;">Notes:</h3>
        <p style="margin: 0; color: #4b5563;">${G(a.notes||"Thank you for your business!")}</p>
      </div>
    </div>
  `}(e,m,o),q=(0,B.oO)();await (0,B._Q)(q,"invoice email");let r=(0,C.Bm)(c,e.invoiceNumber);if(!r)return console.error("PDF file not found for invoice:",c),v.NextResponse.json({error:"PDF file not found. Please try generating the invoice again."},{status:404});let{filePath:s,filename:t}=r;console.log(`Found PDF file: ${t} at ${s}`);let u=E().readFileSync(s),D=m?.name||"InsightBooks",H=(0,B.rd)(D),I=m?.settings?.businessEmail||process.env.EMAIL_FROM||process.env.EMAIL_USER,J={from:H,replyTo:I,to:l.join(", "),subject:o?`Payment Confirmation - Invoice #${e.invoiceNumber} from ${D}`:`Invoice #${e.invoiceNumber} from ${D}`,html:`
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: ${m?.primaryColor||"#4338ca"};">${G(D)}</h2>
            </div>
            <p>Hello ${G(e.client.name)},</p>
            <p>${o?`Your invoice #${G(String(e.invoiceNumber))} has been paid. Please find the payment confirmation below.`:`Please find your invoice #${G(String(e.invoiceNumber))} below.`}</p>
            ${g?`<p>${G(g)}</p>`:""}

            ${p}

            <p style="margin-top: 20px;">If you have any questions about this invoice, please contact us.</p>
            <p>Thank you for your business!</p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #6b7280;">
              <p>${G(m?.settings?.emailFooter||`\xa9 ${new Date().getFullYear()} ${D}. All rights reserved.`)}</p>
            </div>
          </div>
        `,text:`Hello ${e.client.name},

${o?`Your invoice #${e.invoiceNumber} has been paid. Please find the payment confirmation below.`:`Please find your invoice #${e.invoiceNumber} below.`}

${g?g+"\n\n":""}Total amount: ${(0,y.vv)(e.total)}
Due date: ${(0,y.Yq)(e.dueDate)}

If you have any questions about this invoice, please contact us.

Thank you for your business!

\xa9 ${new Date().getFullYear()} ${D}. All rights reserved.`,attachments:[{filename:t||`invoice-${c}.pdf`,content:u,contentType:"application/pdf"}]};for(let a of i){let b=Buffer.from(await a.arrayBuffer()),c=a.name||`attachment-${Date.now()}`;J.attachments.push({filename:c,content:b})}console.log("Sending invoice email with options:",{from:J.from,to:J.to,subject:J.subject});let K=await q.sendMail(J);if(Array.isArray(K.rejected)&&K.rejected.length>0)throw Error(`Email rejected by server: ${K.rejected.join(", ")}`);console.log("Invoice email sent successfully:",{messageId:K.messageId,response:K.response,accepted:K.accepted,rejected:K.rejected});try{(0,C.xA)(c,e.invoiceNumber)?console.log(`PDF file deleted for invoice ${c}`):console.log("No PDF file found to delete - this is normal if file was already cleaned up")}catch(a){console.error("Failed to delete PDF file:",a)}K.messageUrl?console.log("Preview URL: %s",K.messageUrl):F.getTestMessageUrl&&F.getTestMessageUrl(K)&&console.log("Preview URL: %s",F.getTestMessageUrl(K));let L=!1,M=e;return"Draft"===e.status&&(L=!0,M=await w.default.invoice.update({where:{id:c},data:{status:"Pending"},include:{client:!0,items:!0}})),await w.default.auditLog.create({data:{action:"INVOICE_SENT",entityType:"INVOICE",entityId:c,userId:d.id,tenantId:d.tenantId,details:JSON.stringify({invoiceNumber:e.invoiceNumber,clientId:e.clientId,clientEmail:e.client.email,messageId:K.messageId,statusUpdated:L})}}),v.NextResponse.json({message:"Invoice sent successfully",invoice:M,statusUpdated:L,emailSent:!0,messageId:K.messageId})}catch(c){console.error("Error sending invoice:",c);let a=c?.message||"Unknown error",b=c?.code==="EAUTH"||c?.code==="ESOCKET"||/smtp|mail|recipient|sender/i.test(a);return v.NextResponse.json({error:b?`Failed to send invoice email: ${a}. Check SMTP settings and that the From address matches your mail account.`:`Failed to send invoice: ${a}`},{status:500})}}let I=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/invoices/[id]/send/route",pathname:"/api/invoices/[id]/send",filename:"route",bundlePath:"app/api/invoices/[id]/send/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"C:\\laragon\\www\\insight-books-v2.5\\app\\api\\invoices\\[id]\\send\\route.js",nextConfigOutput:"",userland:d,...{}}),{workAsyncStorage:J,workUnitAsyncStorage:K,serverHooks:L}=I;function M(){return(0,g.patchFetch)({workAsyncStorage:J,workUnitAsyncStorage:K})}async function N(a,b,c){c.requestMeta&&(0,h.setRequestMeta)(a,c.requestMeta),I.isDev&&(0,h.addRequestMeta)(a,"devRequestTimingInternalsEnd",process.hrtime.bigint());let d="/api/invoices/[id]/send/route";"/index"===d&&(d="/");let e=await I.prepare(a,b,{srcPage:d,multiZoneDraftMode:!1});if(!e)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:g,deploymentId:v,params:w,nextConfig:x,parsedUrl:y,isDraftMode:z,prerenderManifest:A,routerServerContext:B,isOnDemandRevalidate:C,revalidateOnlyGenerated:D,resolvedPathname:E,clientReferenceManifest:F,serverActionsManifest:G}=e,H=(0,k.normalizeAppPath)(d),J=!!(A.dynamicRoutes[H]||A.routes[E]),K=async()=>((null==B?void 0:B.render404)?await B.render404(a,b,y,!1):b.end("This page could not be found"),null);if(J&&!z){let a=!!A.routes[E],b=A.dynamicRoutes[H];if(b&&!1===b.fallback&&!a){if(x.adapterPath)return await K();throw new t.NoFallbackError}}let L=null;!J||I.isDev||z||(L="/index"===(L=E)?"/":L);let M=!0===I.isDev||!J,N=J&&!M;G&&F&&(0,j.setManifestsSingleton)({page:d,clientReferenceManifest:F,serverActionsManifest:G});let O=a.method||"GET",P=(0,i.getTracer)(),Q=P.getActiveScopeSpan(),R=!!(null==B?void 0:B.isWrappedByNextServer),S=!!(0,h.getRequestMeta)(a,"minimalMode"),T=(0,h.getRequestMeta)(a,"incrementalCache")||await I.getIncrementalCache(a,x,A,S);null==T||T.resetRequestCache(),globalThis.__incrementalCache=T;let U={params:w,previewProps:A.preview,renderOpts:{experimental:{authInterrupts:!!x.experimental.authInterrupts},cacheComponents:!!x.cacheComponents,supportsDynamicResponse:M,incrementalCache:T,cacheLifeProfiles:x.cacheLife,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d,e)=>I.onRequestError(a,b,d,e,B)},sharedContext:{buildId:g,deploymentId:v}},V=new l.NodeNextRequest(a),W=new l.NodeNextResponse(b),X=m.NextRequestAdapter.fromNodeNextRequest(V,(0,m.signalFromNodeResponse)(b));try{let e,g=async a=>I.handle(X,U).finally(()=>{if(!a)return;a.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let c=P.getRootSpanAttributes();if(!c)return;if(c.get("next.span_type")!==n.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${c.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let f=c.get("next.route");if(f){let b=`${O} ${f}`;a.setAttributes({"next.route":f,"http.route":f,"next.span_name":b}),a.updateName(b),e&&e!==a&&(e.setAttribute("http.route",f),e.updateName(b))}else a.updateName(`${O} ${d}`)}),h=async e=>{var h,i;let j=async({previousCacheEntry:f})=>{try{if(!S&&C&&D&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let d=await g(e);a.fetchMetrics=U.renderOpts.fetchMetrics;let h=U.renderOpts.pendingWaitUntil;h&&c.waitUntil&&(c.waitUntil(h),h=void 0);let i=U.renderOpts.collectedTags;if(!J)return await (0,p.I)(V,W,d,U.renderOpts.pendingWaitUntil),null;{let a=await d.blob(),b=(0,q.toNodeOutgoingHttpHeaders)(d.headers);i&&(b[s.NEXT_CACHE_TAGS_HEADER]=i),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==U.renderOpts.collectedRevalidate&&!(U.renderOpts.collectedRevalidate>=s.INFINITE_CACHE)&&U.renderOpts.collectedRevalidate,e=void 0===U.renderOpts.collectedExpire||U.renderOpts.collectedExpire>=s.INFINITE_CACHE?void 0:U.renderOpts.collectedExpire;return{value:{kind:u.CachedRouteKind.APP_ROUTE,status:d.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:e}}}}catch(b){throw(null==f?void 0:f.isStale)&&await I.onRequestError(a,b,{routerKind:"App Router",routePath:d,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:N,isOnDemandRevalidate:C})},!1,B),b}},k=await I.handleResponse({req:a,nextConfig:x,cacheKey:L,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:A,isRoutePPREnabled:!1,isOnDemandRevalidate:C,revalidateOnlyGenerated:D,responseGenerator:j,waitUntil:c.waitUntil,isMinimalMode:S});if(!J)return null;if((null==k||null==(h=k.value)?void 0:h.kind)!==u.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==k||null==(i=k.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});S||b.setHeader("x-nextjs-cache",C?"REVALIDATED":k.isMiss?"MISS":k.isStale?"STALE":"HIT"),z&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let l=(0,q.fromNodeOutgoingHttpHeaders)(k.value.headers);return S&&J||l.delete(s.NEXT_CACHE_TAGS_HEADER),!k.cacheControl||b.getHeader("Cache-Control")||l.get("Cache-Control")||l.set("Cache-Control",(0,r.getCacheControlHeader)(k.cacheControl)),await (0,p.I)(V,W,new Response(k.value.body,{headers:l,status:k.value.status||200})),null};R&&Q?await h(Q):(e=P.getActiveScopeSpan(),await P.withPropagatedContext(a.headers,()=>P.trace(n.BaseServerSpan.handleRequest,{spanName:`${O} ${d}`,kind:i.SpanKind.SERVER,attributes:{"http.method":O,"http.target":a.url}},h),void 0,!R))}catch(b){if(b instanceof t.NoFallbackError||await I.onRequestError(a,b,{routerKind:"App Router",routePath:H,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:N,isOnDemandRevalidate:C})},!1,B),J)throw b;return await (0,p.I)(V,W,new Response(null,{status:500})),null}}},290086:(a,b,c)=>{"use strict";c.d(b,{Bm:()=>n,MR:()=>m,hN:()=>o,v2:()=>l,xA:()=>p});var d=c(629021),e=c.n(d),f=c(333873),g=c.n(f),h=c(321820),i=c.n(h);let j="insightbooks-invoices";function k(){return[g().join(i().tmpdir(),j),g().join(process.cwd(),"tmp")]}function l(){for(let a of k())try{return e().existsSync(a)||e().mkdirSync(a,{recursive:!0}),e().accessSync(a,e().constants.W_OK),a}catch{}let a=g().join(i().tmpdir(),j);return e().mkdirSync(a,{recursive:!0}),a}function m(a,b){let c=[`invoice-${a}.pdf`];return null!=b&&""!==b&&(c.push(`invoice-INV-${b}.pdf`),c.push(`invoice-${b}.pdf`)),c}function n(a,b){let c=m(a,b);for(let a of k())for(let b of c){let c=g().join(a,b);if(e().existsSync(c))return{filePath:c,filename:b,dir:a}}return null}function o(a,b){let c=l(),d=g().join(c,b);return e().writeFileSync(d,a),{filePath:d,filename:b,dir:c}}function p(a,b){let c=n(a,b);return!!c&&(e().unlinkSync(c.filePath),!0)}},296487:()=>{},321820:a=>{"use strict";a.exports=require("os")},328354:a=>{"use strict";a.exports=require("util")},332863:(a,b,c)=>{"use strict";c.d(b,{Yq:()=>i,uB:()=>h,vv:()=>e,zi:()=>g});var d=c(12014);let e=(a,b="MWK",c=!0)=>{let e=(0,d.By)(a),f=new Intl.NumberFormat("en-US",{style:"decimal",minimumFractionDigits:2,maximumFractionDigits:2}).format(e);if(!c)return f;try{return new Intl.NumberFormat("en-US",{style:"currency",currency:b,minimumFractionDigits:2,maximumFractionDigits:2}).format(e)}catch(a){return console.warn(`Invalid currency code: ${b}. Using fallback format.`),`${b} ${f}`}},f=new Intl.NumberFormat("en-US",{style:"decimal",minimumFractionDigits:0,maximumFractionDigits:2}),g=a=>f.format((0,d.By)(a)),h=(a,b="MWK")=>{let c=(0,d.By)(a),e=f.format(c);try{return new Intl.NumberFormat("en-US",{style:"currency",currency:b,minimumFractionDigits:0,maximumFractionDigits:2}).format(c)}catch(a){return`${b} ${e}`}},i=a=>{if(!a)return"";try{let b=new Date(a),c=String(b.getDate()).padStart(2,"0"),d=String(b.getMonth()+1).padStart(2,"0"),e=b.getFullYear();return`${c}-${d}-${e}`}catch(a){return console.error("Invalid date format",a),""}}},333873:a=>{"use strict";a.exports=require("path")},379551:a=>{"use strict";a.exports=require("url")},390780:(a,b,c)=>{"use strict";function d(a){return Number(a?.taxAmount??a?.total??a?.totalAmount??0)||0}function e({taxAmount:a,taxLines:b}={}){return!!((Number(a)||0)>1e-6||Array.isArray(b)&&b.some(a=>d(a)>1e-6))}function f(a=[]){return!!Array.isArray(a)&&a.some(a=>{let b=Number(a?.taxRate)||0,c=Number(a?.taxAmount)||0,e=Number(a?.lineTaxAmount)||0;return b>1e-6||c>1e-6||e>1e-6||(a?.itemTaxes||a?.taxes||[]).some(a=>d(a)>1e-6)})}c.d(b,{ME:()=>e,Vr:()=>f})},455511:a=>{"use strict";a.exports=require("crypto")},476706:(a,b,c)=>{"use strict";c.d(b,{Kh:()=>f,Pz:()=>e});var d=c(215220);async function e(a,b){if(!a?.id||!b)return!1;if(a.role?.name==="MASTER_ADMIN")return!!await d.default.tenant.findUnique({where:{id:b},select:{id:!0}});if(a.tenantId===b||await d.default.tenant.findFirst({where:{id:b,ownerUserId:a.id},select:{id:!0}}))return!0;let[c,e]=await Promise.all([d.default.tenantMembership.findFirst({where:{userId:a.id,tenantId:b,status:{equals:"active",mode:"insensitive"}},select:{id:!0}}),d.default.user.findUnique({where:{id:a.id},select:{tenants:{where:{id:b},select:{id:!0}}}})]);return!!c||(e?.tenants?.length??0)>0}async function f(a,b=d.default){if(!a)return null;let c=await b.tenant.findUnique({where:{id:a},select:{id:!0,name:!0}});if(!c)return null;let e=await b.branch.findFirst({where:{tenantId:a},orderBy:{createdAt:"asc"},select:{id:!0,isActive:!0}});if(e)return e.isActive||await b.branch.update({where:{id:e.id},data:{isActive:!0}}),await b.tenant.update({where:{id:a},data:{defaultBranchId:e.id}}),e.id;let g=c.name?`${c.name} — stock`:"Main location",h=g.length>120?g.slice(0,120):g,i=await b.branch.create({data:{tenantId:a,name:h,isActive:!0},select:{id:!0}});return await b.tenant.update({where:{id:a},data:{defaultBranchId:i.id}}),i.id}},487550:a=>{"use strict";a.exports=require("better-sqlite3")},491645:a=>{"use strict";a.exports=require("net")},529294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},579646:a=>{"use strict";a.exports=require("child_process")},594735:a=>{"use strict";a.exports=require("events")},629021:a=>{"use strict";a.exports=require("fs")},663033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},710846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},714985:a=>{"use strict";a.exports=require("dns")},744870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},781630:a=>{"use strict";a.exports=require("http")},896330:a=>{"use strict";a.exports=require("@prisma/client")},903295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},927910:a=>{"use strict";a.exports=require("stream")},986439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")}};var b=require("../../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[64741,65573,81813,35924,1026,93202,22480],()=>b(b.s=281032));module.exports=c})();