exports.id=13177,exports.ids=[13177],exports.modules={78335:()=>{},215220:(a,b,c)=>{"use strict";c.r(b),c.d(b,{default:()=>g,prisma:()=>f});var d=c(896330);let e=global,f=(e.prisma,e.prisma||(e.prisma=new d.PrismaClient({log:["error"]})),e.prisma),g=f},288584:a=>{let b={};null!=process.env.DOTENV_CONFIG_ENCODING&&(b.encoding=process.env.DOTENV_CONFIG_ENCODING),null!=process.env.DOTENV_CONFIG_PATH&&(b.path=process.env.DOTENV_CONFIG_PATH),null!=process.env.DOTENV_CONFIG_QUIET&&(b.quiet=process.env.DOTENV_CONFIG_QUIET),null!=process.env.DOTENV_CONFIG_DEBUG&&(b.debug=process.env.DOTENV_CONFIG_DEBUG),null!=process.env.DOTENV_CONFIG_OVERRIDE&&(b.override=process.env.DOTENV_CONFIG_OVERRIDE),null!=process.env.DOTENV_CONFIG_DOTENV_KEY&&(b.DOTENV_KEY=process.env.DOTENV_CONFIG_DOTENV_KEY),a.exports=b},296487:()=>{},380127:(a,b,c)=>{let d=c(629021),e=c(333873),f=c(321820),g=c(455511),h=c(877336).version,i=/(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;function j(a){console.log(`[dotenv@${h}][DEBUG] ${a}`)}function k(a){console.log(`[dotenv@${h}] ${a}`)}function l(a){return a&&a.DOTENV_KEY&&a.DOTENV_KEY.length>0?a.DOTENV_KEY:process.env.DOTENV_KEY&&process.env.DOTENV_KEY.length>0?process.env.DOTENV_KEY:""}function m(a){let b=null;if(a&&a.path&&a.path.length>0)if(Array.isArray(a.path))for(let c of a.path)d.existsSync(c)&&(b=c.endsWith(".vault")?c:`${c}.vault`);else b=a.path.endsWith(".vault")?a.path:`${a.path}.vault`;else b=e.resolve(process.cwd(),".env.vault");return d.existsSync(b)?b:null}function n(a){return"~"===a[0]?e.join(f.homedir(),a.slice(1)):a}let o={configDotenv:function(a){let b,c=e.resolve(process.cwd(),".env"),f="utf8",g=!!(a&&a.debug),h=!a||!("quiet"in a)||a.quiet;a&&a.encoding?f=a.encoding:g&&j("No encoding is specified. UTF-8 is used by default");let i=[c];if(a&&a.path)if(Array.isArray(a.path))for(let b of(i=[],a.path))i.push(n(b));else i=[n(a.path)];let l={};for(let c of i)try{let b=o.parse(d.readFileSync(c,{encoding:f}));o.populate(l,b,a)}catch(a){g&&j(`Failed to load ${c} ${a.message}`),b=a}let m=process.env;if(a&&null!=a.processEnv&&(m=a.processEnv),o.populate(m,l,a),g||!h){let a=Object.keys(l).length,c=[];for(let a of i)try{let b=e.relative(process.cwd(),a);c.push(b)}catch(c){g&&j(`Failed to load ${a} ${c.message}`),b=c}k(`injecting env (${a}) from ${c.join(",")}`)}return b?{parsed:l,error:b}:{parsed:l}},_configVault:function(a){let b=!!(a&&a.debug),c=!a||!("quiet"in a)||a.quiet;(b||!c)&&k("Loading env from encrypted .env.vault");let d=o._parseVault(a),e=process.env;return a&&null!=a.processEnv&&(e=a.processEnv),o.populate(e,d,a),{parsed:d}},_parseVault:function(a){let b,c=m(a=a||{});a.path=c;let d=o.configDotenv(a);if(!d.parsed){let a=Error(`MISSING_DATA: Cannot parse ${c} for an unknown reason`);throw a.code="MISSING_DATA",a}let e=l(a).split(","),f=e.length;for(let a=0;a<f;a++)try{let c=e[a].trim(),f=function(a,b){let c;try{c=new URL(b)}catch(a){if("ERR_INVALID_URL"===a.code){let a=Error("INVALID_DOTENV_KEY: Wrong format. Must be in valid uri format like dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=development");throw a.code="INVALID_DOTENV_KEY",a}throw a}let d=c.password;if(!d){let a=Error("INVALID_DOTENV_KEY: Missing key part");throw a.code="INVALID_DOTENV_KEY",a}let e=c.searchParams.get("environment");if(!e){let a=Error("INVALID_DOTENV_KEY: Missing environment part");throw a.code="INVALID_DOTENV_KEY",a}let f=`DOTENV_VAULT_${e.toUpperCase()}`,g=a.parsed[f];if(!g){let a=Error(`NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${f} in your .env.vault file.`);throw a.code="NOT_FOUND_DOTENV_ENVIRONMENT",a}return{ciphertext:g,key:d}}(d,c);b=o.decrypt(f.ciphertext,f.key);break}catch(b){if(a+1>=f)throw b}return o.parse(b)},config:function(a){if(0===l(a).length)return o.configDotenv(a);let b=m(a);if(!b){var c;return c=`You set DOTENV_KEY but you are missing a .env.vault file at ${b}. Did you forget to build it?`,console.log(`[dotenv@${h}][WARN] ${c}`),o.configDotenv(a)}return o._configVault(a)},decrypt:function(a,b){let c=Buffer.from(b.slice(-64),"hex"),d=Buffer.from(a,"base64"),e=d.subarray(0,12),f=d.subarray(-16);d=d.subarray(12,-16);try{let a=g.createDecipheriv("aes-256-gcm",c,e);return a.setAuthTag(f),`${a.update(d)}${a.final()}`}catch(d){let a=d instanceof RangeError,b="Invalid key length"===d.message,c="Unsupported state or unable to authenticate data"===d.message;if(a||b){let a=Error("INVALID_DOTENV_KEY: It must be 64 characters long (or more)");throw a.code="INVALID_DOTENV_KEY",a}if(c){let a=Error("DECRYPTION_FAILED: Please check your DOTENV_KEY");throw a.code="DECRYPTION_FAILED",a}throw d}},parse:function(a){let b,c={},d=a.toString();for(d=d.replace(/\r\n?/mg,"\n");null!=(b=i.exec(d));){let a=b[1],d=b[2]||"",e=(d=d.trim())[0];d=d.replace(/^(['"`])([\s\S]*)\1$/mg,"$2"),'"'===e&&(d=(d=d.replace(/\\n/g,"\n")).replace(/\\r/g,"\r")),c[a]=d}return c},populate:function(a,b,c={}){let d=!!(c&&c.debug),e=!!(c&&c.override);if("object"!=typeof b){let a=Error("OBJECT_REQUIRED: Please check the processEnv argument being passed to populate");throw a.code="OBJECT_REQUIRED",a}for(let c of Object.keys(b))Object.prototype.hasOwnProperty.call(a,c)?(!0===e&&(a[c]=b[c]),d&&(!0===e?j(`"${c}" is already defined and WAS overwritten`):j(`"${c}" is already defined and was NOT overwritten`))):a[c]=b[c]}};a.exports.configDotenv=o.configDotenv,a.exports._configVault=o._configVault,a.exports._parseVault=o._parseVault,a.exports.config=o.config,a.exports.decrypt=o.decrypt,a.exports.parse=o.parse,a.exports.populate=o.populate,a.exports=o},414198:(a,b,c)=>{"use strict";c.d(b,{AY:()=>h,WU:()=>g,dq:()=>i});var d=c(235924);c(806028);let e=async()=>{let a=!!(process.env.EMAIL_HOST&&process.env.EMAIL_USER&&process.env.EMAIL_PASSWORD);if(console.log(`Creating email transporter - hasEmailConfig: ${a}, NODE_ENV: production`),a){console.log("✅ Using Hostinger SMTP configuration (email config detected):",{host:process.env.EMAIL_HOST,port:Number(process.env.EMAIL_PORT),secure:"true"===process.env.EMAIL_SECURE,user:process.env.EMAIL_USER,from:process.env.EMAIL_FROM});let a={host:process.env.EMAIL_HOST,port:Number(process.env.EMAIL_PORT),secure:"true"===process.env.EMAIL_SECURE,auth:{user:process.env.EMAIL_USER,pass:process.env.EMAIL_PASSWORD},debug:!0,logger:!0};return"smtp.hostinger.com"===process.env.EMAIL_HOST&&("465"===process.env.EMAIL_PORT?(a.port=465,a.secure=!0,a.requireTLS=!1,a.ignoreTLS=!0):(a.port=587,a.secure=!1,a.requireTLS=!0,a.ignoreTLS=!1),a.tls={rejectUnauthorized:!0},a.authMethod="PLAIN"),d.createTransport(a)}console.log("⚠️  No email configuration found, falling back to Ethereal test account for development"),console.log("   To use Hostinger SMTP, ensure EMAIL_HOST, EMAIL_USER, and EMAIL_PASSWORD are set in your environment");try{let a=await d.createTestAccount();return console.log("Ethereal test account created:",a.user),d.createTransport({host:"smtp.ethereal.email",port:587,secure:!1,auth:{user:a.user,pass:a.pass},debug:!0})}catch(a){throw console.error("Failed to create Ethereal test account:",a),a}};async function f(a,b){try{await a.verify(),console.log(`SMTP verify OK (${b})`)}catch(a){console.warn(`SMTP verify() failed (${b}); attempting send anyway:`,a?.message||a)}}async function g(a,b,c){try{console.log(`Attempting to send OTP email to: ${a}`);let g=await e();await f(g,"OTP email");let h={from:process.env.EMAIL_FROM||`"InsightBooks" <${process.env.EMAIL_USER}>`,to:a,subject:"Verify Your Email - InsightBooks",headers:{"X-Mailer":"InsightBooks/1.0"},html:`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email - InsightBooks</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%); padding: 30px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">InsightBooks</h1>
              <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">Business Management Platform</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Verify Your Email Address</h2>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hello ${c||"there"},
              </p>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                Thank you for signing up with InsightBooks. To complete your registration and access your account, please verify your email address using the verification code below:
              </p>
              
              <!-- OTP Code -->
              <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); padding: 25px; text-align: center; border-radius: 12px; margin: 30px 0; border: 2px solid #d1d5db;">
                <h2 style="margin: 0; letter-spacing: 8px; color: #4338ca; font-size: 32px; font-weight: 700; font-family: 'Courier New', monospace;">${b}</h2>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0 0 30px 0;">
                ⏰ This verification code will expire in <strong>10 minutes</strong>
              </p>
              
              <!-- Security Notice -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 30px 0; border-radius: 4px;">
                <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.5;">
                  🔒 <strong>Security Notice:</strong> If you didn't sign up for InsightBooks, please ignore this email. Never share this verification code with anyone.
                </p>
              </div>
              
              <!-- Action Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.APP_URL||"https://insightbooksafrica.com"}/auth/login" 
                   style="display: inline-block; background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%); color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(67, 56, 202, 0.25);">
                  🚀 Access Your Account
                </a>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f9fafb; padding: 25px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 15px 0;">
                \xa9 ${new Date().getFullYear()} InsightBooks. All rights reserved.
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0 0 10px 0;">
                This email was sent to ${a} because you signed up for InsightBooks.
              </p>
              <div style="margin-top: 15px;">
                <a href="mailto:support@insightbooksafrica.com" style="color: #6366f1; text-decoration: none; font-size: 12px; margin: 0 10px;">Support</a>
                <span style="color: #d1d5db;">|</span>
                <a href="mailto:unsubscribe@insightbooksafrica.com" style="color: #6366f1; text-decoration: none; font-size: 12px; margin: 0 10px;">Unsubscribe</a>
          </div>
          </div>
          </div>
        </body>
        </html>
      `,text:`Verify Your Email - InsightBooks

Hello ${c||"there"},

Thank you for signing up with InsightBooks. To complete your registration and access your account, please verify your email address using the verification code below:

VERIFICATION CODE: ${b}

This verification code will expire in 10 minutes.

Security Notice: If you didn't sign up for InsightBooks, please ignore this email. Never share this verification code with anyone.

Access your account: ${process.env.APP_URL||"https://insightbooksafrica.com"}/auth/login

\xa9 ${new Date().getFullYear()} InsightBooks. All rights reserved.
This email was sent to ${a} because you signed up for InsightBooks.

Support: support@insightbooksafrica.com
Unsubscribe: unsubscribe@insightbooksafrica.com`};console.log("Sending email with options:",{from:h.from,to:h.to,subject:h.subject});let i=await g.sendMail(h);if(console.log("Email sent successfully:",{messageId:i.messageId,response:i.response,accepted:i.accepted,rejected:i.rejected}),i.rejected?.length)return{success:!1,error:`SMTP rejected recipient(s): ${i.rejected.join(", ")}`,messageId:i.messageId};return i.messageUrl?console.log("Preview URL: %s",i.messageUrl):d.getTestMessageUrl&&d.getTestMessageUrl(i)&&console.log("Preview URL: %s",d.getTestMessageUrl(i)),{success:!0,messageId:i.messageId,response:i.response,accepted:i.accepted,rejected:i.rejected}}catch(a){return console.error("Error sending email:",a),{success:!1,error:a.message,code:a.code,command:a.command}}}async function h(a,b,c,g,h,i){try{console.log(`Attempting to send daily report email to: ${a}`);let b=await e();await f(b,"daily report");let j={from:process.env.EMAIL_FROM||`"InsightBooks" <${process.env.EMAIL_USER}>`,to:a,subject:`Daily Financial Report - ${c} - ${new Date(g).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}`,html:h,text:i};console.log("Sending daily report email with options:",{from:j.from,to:j.to,subject:j.subject});let k=await b.sendMail(j);return console.log("Daily report email sent successfully:",{messageId:k.messageId,response:k.response,accepted:k.accepted,rejected:k.rejected}),k.messageUrl?console.log("Preview URL: %s",k.messageUrl):d.getTestMessageUrl&&d.getTestMessageUrl(k)&&console.log("Preview URL: %s",d.getTestMessageUrl(k)),{success:!0,messageId:k.messageId,response:k.response,accepted:k.accepted,rejected:k.rejected}}catch(a){return console.error("Error sending daily report email:",a),{success:!1,error:a.message,code:a.code,command:a.command}}}async function i(a,b,c,g,h,i,j,k){try{console.log(`Attempting to send subscription expiry reminder email to: ${a}, days remaining: ${g}`);let l=await e();await f(l,"subscription reminder");let m=a=>new Date(a).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"}),n=1===g,o=i?"Free Trial":"Subscription",p=n?"#dc2626":"#f59e0b",q=n?"\uD83D\uDEA8":"⏰",r=n?"Your subscription expires TOMORROW! Act now to prevent service interruption and maintain uninterrupted access to all your business tools.":"Your subscription expires in 2 days. Renew today to ensure seamless continuity and avoid any disruption to your business operations.",s=n?"\uD83D\uDEA8 Renew Now - Don't Lose Access!":"✨ Renew Subscription - Secure Your Access",t=n?"Click below to renew immediately and avoid service interruption":"Renew now to continue enjoying all premium features",u=n?`🚨 URGENT: ${o} Expires Tomorrow - Action Required for ${c}`:`⏰ ${o} Expiring in 2 Days - Renew Now for ${c}`,v=`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${u}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15); overflow: hidden;">
          <!-- Header with Gradient and Pulse Effect -->
          <div style="background: linear-gradient(135deg, ${n?"#dc2626":"#f59e0b"} 0%, ${n?"#b91c1c":"#d97706"} 100%); padding: 45px 30px; text-align: center; position: relative; overflow: hidden;">
            <div style="position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%); animation: pulse 3s ease-in-out infinite;"></div>
            <div style="font-size: 56px; margin-bottom: 15px; position: relative; z-index: 1;">${q}</div>
            <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.5px; position: relative; z-index: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${n?"Action Required: Your Subscription Expires Tomorrow":"Friendly Reminder: Your Subscription Expires Soon"}</h1>
            <p style="color: #ffffff; margin: 15px 0 0 0; font-size: 18px; opacity: 0.95; position: relative; z-index: 1; font-weight: 500;">${c}</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 45px 35px;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 26px; font-weight: 700; line-height: 1.3;">Hello ${b||"Valued Customer"},</h2>
            
            <p style="color: #4b5563; font-size: 17px; line-height: 1.8; margin: 0 0 30px 0;">
              We hope this message finds you well. We wanted to bring to your attention that your <strong style="color: #1f2937;">${o.toLowerCase()}</strong> for <strong style="color: #1f2937;">${c}</strong> is approaching its expiration date.
            </p>

            <!-- Urgency Alert Box with Enhanced Design -->
            <div style="background: linear-gradient(135deg, ${n?"#fee2e2":"#fef3c7"} 0%, ${n?"#fecaca":"#fde68a"} 100%); border: 3px solid ${n?"#dc2626":"#f59e0b"}; padding: 25px; margin: 35px 0; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              <div style="display: flex; align-items: flex-start; gap: 15px;">
                <div style="font-size: 32px; line-height: 1;">${q}</div>
                <div style="flex: 1;">
                  <p style="color: ${p}; font-size: 18px; font-weight: 700; margin: 0 0 12px 0; line-height: 1.4;">
                    ${r}
                  </p>
                  <div style="background-color: rgba(255,255,255,0.7); padding: 15px; border-radius: 8px; margin-top: 15px;">
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 6px 0; color: ${p}; font-size: 15px; font-weight: 600;">Expiry Date:</td>
                        <td style="padding: 6px 0; color: ${p}; font-size: 15px; font-weight: 700; text-align: right;">${m(h)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: ${p}; font-size: 15px; font-weight: 600;">Time Remaining:</td>
                        <td style="padding: 6px 0; color: ${p}; font-size: 15px; font-weight: 700; text-align: right;">${g} day${1!==g?"s":""}</td>
                      </tr>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <!-- What Happens If You Don't Renew -->
            <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-left: 4px solid #dc2626; padding: 22px; margin: 30px 0; border-radius: 8px;">
              <h3 style="color: #991b1b; margin: 0 0 12px 0; font-size: 18px; font-weight: 700;">⚠️ What Happens If You Don't Renew?</h3>
              <ul style="color: #7f1d1d; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 22px;">
                <li style="margin-bottom: 8px;">You'll lose access to all premium features and data</li>
                <li style="margin-bottom: 8px;">Your business operations may be interrupted</li>
                <li style="margin-bottom: 8px;">You'll need to set up your account again after renewal</li>
                <li>Potential loss of historical data and reports</li>
              </ul>
            </div>

            <!-- Subscription Details Card -->
            <div style="background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); border-radius: 10px; padding: 25px; margin: 30px 0; border: 1px solid #e5e7eb;">
              <h3 style="color: #1f2937; margin: 0 0 18px 0; font-size: 20px; font-weight: 700; display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 24px;">📋</span> Your Subscription Details
              </h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-size: 15px; border-bottom: 1px solid #e5e7eb;">Plan:</td>
                  <td style="padding: 10px 0; color: #1f2937; font-size: 15px; font-weight: 700; text-align: right; border-bottom: 1px solid #e5e7eb;">${j||"Premium"}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-size: 15px; border-bottom: 1px solid #e5e7eb;">Type:</td>
                  <td style="padding: 10px 0; color: #1f2937; font-size: 15px; font-weight: 700; text-align: right; border-bottom: 1px solid #e5e7eb;">${o}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-size: 15px;">Expires:</td>
                  <td style="padding: 10px 0; color: #1f2937; font-size: 15px; font-weight: 700; text-align: right;">${m(h)}</td>
                </tr>
              </table>
            </div>

            <!-- Benefits Reminder with Icons -->
            <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 10px; padding: 25px; margin: 30px 0; border: 2px solid #3b82f6;">
              <h3 style="color: #1e40af; margin: 0 0 18px 0; font-size: 20px; font-weight: 700; display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 24px;">✨</span> Continue Enjoying These Premium Benefits
              </h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 20px;">📄</span>
                  <span style="color: #1e3a8a; font-size: 14px; font-weight: 500;">Unlimited Documents</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 20px;">📊</span>
                  <span style="color: #1e3a8a; font-size: 14px; font-weight: 500;">Advanced Analytics</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 20px;">📦</span>
                  <span style="color: #1e3a8a; font-size: 14px; font-weight: 500;">Stock Management</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 20px;">👥</span>
                  <span style="color: #1e3a8a; font-size: 14px; font-weight: 500;">Multi-User Access</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 20px;">🔒</span>
                  <span style="color: #1e3a8a; font-size: 14px; font-weight: 500;">Secure Data Storage</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 20px;">💬</span>
                  <span style="color: #1e3a8a; font-size: 14px; font-weight: 500;">Priority Support</span>
                </div>
              </div>
            </div>

            <!-- Primary CTA Button -->
            <div style="text-align: center; margin: 45px 0 25px 0;">
              <a href="${k||`${process.env.APP_URL||"https://insightbooksafrica.com"}/subscription`}" 
                 style="display: inline-block; background: linear-gradient(135deg, ${n?"#dc2626":"#f59e0b"} 0%, ${n?"#b91c1c":"#d97706"} 100%); color: #ffffff; padding: 20px 50px; text-decoration: none; border-radius: 12px; font-weight: 800; font-size: 20px; box-shadow: 0 10px 25px rgba(${n?"220, 38, 38":"245, 158, 11"}, 0.5); text-transform: uppercase; letter-spacing: 0.5px;">
                ${s}
              </a>
              <p style="color: #6b7280; font-size: 14px; margin: 15px 0 0 0; font-weight: 500;">
                ${t}
              </p>
            </div>

            <!-- Trust Indicators -->
            <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 20px; margin: 30px 0; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                <span style="font-size: 24px;">✅</span>
                <p style="color: #166534; font-size: 15px; font-weight: 600; margin: 0;">Quick & Secure Renewal Process</p>
              </div>
              <p style="color: #15803d; font-size: 14px; line-height: 1.6; margin: 0;">
                Renewing takes less than 2 minutes. Your payment is processed securely, and your subscription will be activated immediately.
              </p>
            </div>

            <!-- Help Section -->
            <div style="background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); border-radius: 8px; padding: 22px; margin: 30px 0;">
              <h3 style="color: #334155; margin: 0 0 12px 0; font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 24px;">💡</span> Need Assistance?
              </h3>
              <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 12px 0;">
                Our dedicated support team is standing by to help you with any questions about renewing your subscription, payment options, or account management.
              </p>
              <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0;">
                📧 Email us at <a href="mailto:support@insightbooksafrica.com" style="color: #6366f1; text-decoration: none; font-weight: 600;">support@insightbooksafrica.com</a> or visit our help center.
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); padding: 35px; text-align: center; border-top: 2px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 15px; margin: 0 0 18px 0; font-weight: 500;">
              \xa9 ${new Date().getFullYear()} InsightBooks. All rights reserved.
            </p>
            <p style="color: #9ca3af; font-size: 13px; margin: 0 0 20px 0; line-height: 1.6;">
              This email was sent to ${a} because your ${o.toLowerCase()} for ${c} is expiring soon. 
              ${n?"Please renew immediately to avoid service interruption.":"We recommend renewing early to ensure uninterrupted access."}
            </p>
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <a href="mailto:support@insightbooksafrica.com" style="color: #6366f1; text-decoration: none; font-size: 13px; margin: 0 12px; font-weight: 500;">Support</a>
              <span style="color: #d1d5db;">|</span>
              <a href="${process.env.APP_URL||"https://insightbooksafrica.com"}/subscription" style="color: #6366f1; text-decoration: none; font-size: 13px; margin: 0 12px; font-weight: 500;">Manage Subscription</a>
              <span style="color: #d1d5db;">|</span>
              <a href="${process.env.APP_URL||"https://insightbooksafrica.com"}" style="color: #6366f1; text-decoration: none; font-size: 13px; margin: 0 12px; font-weight: 500;">Visit Website</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,w=`${u}

Hello ${b||"Valued Customer"},

We hope this message finds you well. We wanted to bring to your attention that your ${o.toLowerCase()} for ${c} is approaching its expiration date.

${r}

EXPIRY DETAILS:
- Expiry Date: ${m(h)}
- Time Remaining: ${g} day${1!==g?"s":""}

SUBSCRIPTION DETAILS:
- Plan: ${j||"Premium"}
- Type: ${o}
- Expires: ${m(h)}

⚠️ WHAT HAPPENS IF YOU DON'T RENEW?
- You'll lose access to all premium features and data
- Your business operations may be interrupted
- You'll need to set up your account again after renewal
- Potential loss of historical data and reports

✨ CONTINUE ENJOYING THESE PREMIUM BENEFITS:
- Unlimited Documents (invoices, quotations, receipts)
- Advanced Analytics & Reporting
- Stock Management & Tracking
- Customer & Supplier Management
- Multi-User Access & Permissions
- Secure Data Storage
- Priority Customer Support

${s}
${t}

Renew your subscription now: ${k||`${process.env.APP_URL||"https://insightbooksafrica.com"}/subscription`}

✅ QUICK & SECURE RENEWAL PROCESS
Renewing takes less than 2 minutes. Your payment is processed securely, and your subscription will be activated immediately.

💡 NEED ASSISTANCE?
Our dedicated support team is standing by to help you with any questions about renewing your subscription, payment options, or account management.

📧 Email us at support@insightbooksafrica.com or visit our help center.

\xa9 ${new Date().getFullYear()} InsightBooks. All rights reserved.
This email was sent to ${a} because your ${o.toLowerCase()} for ${c} is expiring soon. ${n?"Please renew immediately to avoid service interruption.":"We recommend renewing early to ensure uninterrupted access."}

Support: support@insightbooksafrica.com
Manage Subscription: ${process.env.APP_URL||"https://insightbooksafrica.com"}/subscription
Visit Website: ${process.env.APP_URL||"https://insightbooksafrica.com"}`,x={from:process.env.EMAIL_FROM||`"InsightBooks" <${process.env.EMAIL_USER}>`,to:a,subject:u,html:v,text:w,headers:{"X-Priority":n?"1":"3","X-MSMail-Priority":n?"High":"Normal",Importance:n?"high":"normal","X-Mailer":"InsightBooks/1.0","X-Report-Abuse":"Please report abuse here: abuse@insightbooksafrica.com","List-Unsubscribe":"<mailto:unsubscribe@insightbooksafrica.com>",Precedence:"bulk"}};console.log("Sending subscription expiry reminder email with options:",{from:x.from,to:x.to,subject:x.subject,daysRemaining:g});let y=await l.sendMail(x);return console.log("Subscription expiry reminder email sent successfully:",{messageId:y.messageId,response:y.response,accepted:y.accepted,rejected:y.rejected}),y.messageUrl?console.log("Preview URL: %s",y.messageUrl):d.getTestMessageUrl&&d.getTestMessageUrl(y)&&console.log("Preview URL: %s",d.getTestMessageUrl(y)),{success:!0,messageId:y.messageId,response:y.response,accepted:y.accepted,rejected:y.rejected}}catch(a){return console.error("Error sending subscription expiry reminder email:",a),{success:!1,error:a.message,code:a.code,command:a.command}}}},806028:(a,b,c)=>{c(380127).config(Object.assign({},c(288584),c(836537)(process.argv)))},836537:a=>{let b=/^dotenv_config_(encoding|path|quiet|debug|override|DOTENV_KEY)=(.+)$/;a.exports=function(a){let c=a.reduce(function(a,c){let d=c.match(b);return d&&(a[d[1]]=d[2]),a},{});return"quiet"in c||(c.quiet="true"),c}},877336:a=>{"use strict";a.exports=JSON.parse('{"name":"dotenv","version":"16.6.1","description":"Loads environment variables from .env file","main":"lib/main.js","types":"lib/main.d.ts","exports":{".":{"types":"./lib/main.d.ts","require":"./lib/main.js","default":"./lib/main.js"},"./config":"./config.js","./config.js":"./config.js","./lib/env-options":"./lib/env-options.js","./lib/env-options.js":"./lib/env-options.js","./lib/cli-options":"./lib/cli-options.js","./lib/cli-options.js":"./lib/cli-options.js","./package.json":"./package.json"},"scripts":{"dts-check":"tsc --project tests/types/tsconfig.json","lint":"standard","pretest":"npm run lint && npm run dts-check","test":"tap run --allow-empty-coverage --disable-coverage --timeout=60000","test:coverage":"tap run --show-full-coverage --timeout=60000 --coverage-report=text --coverage-report=lcov","prerelease":"npm test","release":"standard-version"},"repository":{"type":"git","url":"git://github.com/motdotla/dotenv.git"},"homepage":"https://github.com/motdotla/dotenv#readme","funding":"https://dotenvx.com","keywords":["dotenv","env",".env","environment","variables","config","settings"],"readmeFilename":"README.md","license":"BSD-2-Clause","devDependencies":{"@types/node":"^18.11.3","decache":"^4.6.2","sinon":"^14.0.1","standard":"^17.0.0","standard-version":"^9.5.0","tap":"^19.2.0","typescript":"^4.8.4"},"engines":{"node":">=12"},"browser":{"fs":false}}')}};