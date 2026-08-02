"use strict";exports.id=22480,exports.ids=[22480],exports.modules={822480:(a,b,c)=>{c.d(b,{oO:()=>l,rd:()=>n,sendEmail:()=>o,hb:()=>q,VG:()=>p,_Q:()=>m});var d=c(235924),e=c(79748),f=c(333873),g=c(432894),h=c(870211),i=c(261300);let j=new Map,k={"welcome-email":a=>({subject:function(a,{locale:b,params:c}={}){return function(a,{locale:b="en",params:c={}}={}){let d,e=(d=(0,i.mF)(b),j.has(d)||j.set(d,(0,g.fH)(d)),j.has(i.Xn)||j.set(i.Xn,(0,g.fH)(i.Xn)),{locale:d,messages:{[d]:j.get(d),en:j.get(i.Xn)},englishMessages:j.get(i.Xn)});return(0,h.T)({key:a,locale:e.locale,messages:e.messages,englishMessages:e.englishMessages,params:c,devWarn:!1})}(`emails.${a}`,{locale:b,params:c})}("welcomeSubject",{locale:a.locale||"en"})||`Welcome to ${process.env.COMPANY_NAME||"Insight Books"}`,html:`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome, ${a.name}!</h2>
        <p>Thank you for joining our platform. Your account has been created successfully.</p>
        <p>Here are your login details:</p>
        <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0;">
          <p><strong>Email:</strong> ${a.email}</p>
          <p><strong>Password:</strong> ${a.password}</p>
        </div>
        <p>You can access your account at: <a href="${a.loginUrl}">${a.loginUrl}</a></p>
        <p>For security reasons, we recommend changing your password after your first login.</p>
        <p>If you need any assistance, please contact our support team.</p>
        <p>Best regards,<br>The Team</p>
      </div>
    `}),"affiliate-welcome":a=>({subject:`Welcome to InsightBooks Affiliate Program - ${a.name}`,html:`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">🎉 Welcome to InsightBooks Affiliate Program!</h1>
        </div>
        
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 25px; margin-bottom: 25px;">
          <h2 style="color: #1e293b; margin-top: 0;">Hello ${a.name},</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #475569;">
            Welcome to the InsightBooks Affiliate Program! We're excited to have you on board as a partner.
          </p>
        </div>

        <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; margin-bottom: 25px;">
          <h3 style="color: #1e40af; margin-top: 0;">🚀 Your Affiliate Account Details</h3>
          <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <p style="margin: 8px 0;"><strong>Email:</strong> ${a.email}</p>
            <p style="margin: 8px 0;"><strong>Temporary Password:</strong> <span style="background-color: #fef3c7; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${a.password}</span></p>
            <p style="margin: 8px 0;"><strong>Referral Code:</strong> <span style="background-color: #dbeafe; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${a.referralCode}</span></p>
            <p style="margin: 8px 0;"><strong>Commission Rate:</strong> ${a.commissionRate}%</p>
          </div>
        </div>

        <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 20px; margin-bottom: 25px;">
          <h3 style="color: #15803d; margin-top: 0;">🔑 How to Access Your Account</h3>
          <p style="color: #166534; margin-bottom: 15px;">
            Click the button below to access your affiliate dashboard:
          </p>
          <div style="text-align: center;">
            <a href="${a.loginUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
              🚀 Access Affiliate Dashboard
            </a>
          </div>
          <p style="font-size: 14px; color: #166534; margin-top: 15px; text-align: center;">
            Or copy this link: <a href="${a.loginUrl}" style="color: #2563eb;">${a.loginUrl}</a>
          </p>
        </div>

        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin-bottom: 25px;">
          <h3 style="color: #d97706; margin-top: 0;">⚠️ Important Security Notice</h3>
          <p style="color: #92400e;">
            <strong>For your security:</strong>
          </p>
          <ul style="color: #92400e;">
            <li>Change your password immediately after your first login</li>
            <li>Keep your referral code confidential</li>
            <li>Never share your login credentials</li>
          </ul>
        </div>

        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
          <h3 style="color: #334155; margin-top: 0;">💡 Getting Started</h3>
          <ol style="color: #475569;">
            <li>Login to your affiliate dashboard using the credentials above</li>
            <li>Change your password to something secure</li>
            <li>Start sharing your referral code with potential customers</li>
            <li>Track your referrals and earnings in the dashboard</li>
            <li>Request payouts when you reach the minimum threshold</li>
          </ol>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="color: #64748b; margin-bottom: 10px;">
            Need help? Contact our support team at 
            <a href="mailto:support@insightbooksafrica.com" style="color: #2563eb;">support@insightbooksafrica.com</a>
          </p>
          <p style="color: #64748b; font-size: 14px;">
            Best regards,<br>
            <strong>The InsightBooks Team</strong>
          </p>
        </div>
      </div>
    `}),"password-reset-link":a=>({subject:`Password Reset Request - ${process.env.COMPANY_NAME||"Insight Books"}`,html:`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #dc2626; margin: 0;">🔐 Password Reset Request</h1>
        </div>
        
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 25px; margin-bottom: 25px;">
          <h2 style="color: #1e293b; margin-top: 0;">Hello ${a.name},</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #475569;">
            We received a request to reset your password for your Insight Books account.
          </p>
        </div>

        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin-bottom: 25px;">
          <h3 style="color: #991b1b; margin-top: 0;">⚠️ Important Security Notice</h3>
          <p style="color: #7f1d1d;">
            If you didn't request this password reset, please ignore this email. Your account remains secure.
          </p>
        </div>

        <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; margin-bottom: 25px;">
          <h3 style="color: #1e40af; margin-top: 0;">🔑 Reset Your Password</h3>
          <p style="color: #166534; margin-bottom: 15px;">
            Click the button below to reset your password:
          </p>
          <div style="text-align: center;">
            <a href="${a.resetLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
              🔐 Reset Password
            </a>
          </div>
          <p style="font-size: 14px; color: #166534; margin-top: 15px; text-align: center;">
            Or copy this link: <a href="${a.resetLink}" style="color: #2563eb;">${a.resetLink}</a>
          </p>
        </div>

        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin-bottom: 25px;">
          <h3 style="color: #d97706; margin-top: 0;">⏰ Link Expiry</h3>
          <p style="color: #92400e;">
            This password reset link will expire in <strong>1 hour</strong> for security reasons.
          </p>
        </div>

        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
          <h3 style="color: #334155; margin-top: 0;">💡 Need Help?</h3>
          <p style="color: #475569;">
            If you have any questions or need assistance, please contact our support team.
          </p>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 14px;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      </div>
    `}),"password-reset":a=>({subject:"Password Reset Request",html:`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset</h2>
        <p>Hello ${a.name},</p>
        <p>We received a request to reset your password. Use the following code to complete the process:</p>
        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${a.otp}
        </div>
        <p>This code will expire in ${a.expiryHours} hour(s).</p>
        <p>If you didn't request this reset, please ignore this email or contact support if you have concerns.</p>
        <p>Best regards,<br>The Team</p>
      </div>
    `}),"custom-email":a=>({subject:a.subject||"Message from InsightBooks",html:a.message||`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #1e40af; margin-top: 0;">${a.subject||"Message from InsightBooks"}</h2>
          <p style="color: #64748b; margin: 0;">From: ${a.adminName||"System Administrator"}</p>
        </div>
        
        <div style="background-color: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
          <div style="white-space: pre-wrap; line-height: 1.6; color: #374151;">
            ${a.message||"No message content provided."}
          </div>
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background-color: #f1f5f9; border-radius: 6px; border-left: 4px solid #3b82f6;">
          <p style="margin: 0; color: #475569; font-size: 14px;">
            <strong>Priority:</strong> ${a.priority||"NORMAL"}
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 14px; margin: 0;">
            This is an automated message from the InsightBooks platform.
          </p>
          <p style="color: #64748b; font-size: 12px; margin: 5px 0 0 0;">
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `}),"rich-email":a=>{let b,c="#1e40af",d=a.companyName||a.tenantName||"InsightBooks",e=a.baseUrl||process.env.NEXT_PUBLIC_BASE_URL||"http://213.165.230.139:3000",f=a.tenantLogoUrl,g=null,h=!1;f&&""!==f.trim()&&(g=f.startsWith("http://")||f.startsWith("https://")?f:f.startsWith("/")?`${e}${f}`:`${e}/${f}`,h=!0);let i=(a,b)=>{let c=parseInt(a.replace("#",""),16),d=Math.round(2.55*b);return"#"+(0x1000000+65536*Math.min(255,(c>>16)+d)+256*Math.min(255,(c>>8&255)+d)+Math.min(255,(255&c)+d)).toString(16).slice(1)};i(c,20);let j=i(c,-15),k=(a=>{switch(a?.toLowerCase()){case"urgent":return{bg:"#fef2f2",border:"#ef4444",text:"#dc2626"};case"high":return{bg:"#fff7ed",border:"#f97316",text:"#ea580c"};case"low":return{bg:"#f9fafb",border:"#9ca3af",text:"#6b7280"};default:return{bg:"#eff6ff",border:c,text:j}}})(a.priority);return{subject:a.subject||`Message from ${d}`,html:`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${a.subject||`Message from ${d}`}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <!-- Wrapper Table -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6; padding: 20px 0;">
    <tr>
      <td align="center" style="padding: 0;">
        <!-- Main Container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          
          <!-- Header with Logo or Tenant Name -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px 24px; text-align: center; border-bottom: 2px solid #e5e7eb;">
              ${h?`
                <img src="${g}" alt="${d}" style="max-height: 80px; max-width: 250px; height: auto; width: auto; display: block; margin: 0 auto;" />
              `:`
                <h1 style="margin: 0; color: ${c}; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                  ${d}
                </h1>
              `}
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 24px 24px 24px; background-color: #ffffff;">
              <div style="line-height: 1.7; color: #374151; font-size: 15px;">
                ${!(b=a.htmlContent||a.message)?"No message content provided.":b.includes("<")?b.replace(/<h1[^>]*>/g,`<h1 style="font-size: 24px; font-weight: 700; margin: 16px 0 8px 0; line-height: 1.2; color: ${c};">`).replace(/<h2[^>]*>/g,`<h2 style="font-size: 20px; font-weight: 700; margin: 20px 0 10px 0; line-height: 1.3; color: ${c};">`).replace(/<h3[^>]*>/g,`<h3 style="font-size: 18px; font-weight: 600; margin: 16px 0 8px 0; line-height: 1.4; color: ${j};">`).replace(/<ul[^>]*>/g,'<ul style="margin: 16px 0; padding-left: 20px;">').replace(/<li[^>]*>/g,'<li style="margin: 4px 0; color: #374151; line-height: 1.6;">').replace(/<blockquote[^>]*>/g,`<blockquote style="border-left: 4px solid ${c}; padding-left: 16px; margin: 16px 0; color: #6b7280; font-style: italic; background-color: #f9fafb;">`).replace(/<strong[^>]*>/g,'<strong style="font-weight: 700; color: #111827;">').replace(/<em[^>]*>/g,'<em style="font-style: italic; color: #374151;">').replace(/<u[^>]*>/g,'<u style="text-decoration: underline;">').replace(/<img([^>]*)>/g,'<img$1 style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); margin: 16px 0; display: block; margin-left: auto; margin-right: auto;">'):`<p style="margin: 12px 0; color: #374151; line-height: 1.6;">${b}</p>`}
              </div>
            </td>
          </tr>
          
          <!-- Priority Badge (only shown if showPriority is true) -->
          ${a.showPriority&&a.priority?`
          <tr>
            <td style="padding: 0 24px 24px 24px; background-color: #ffffff;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="padding: 12px 16px; background-color: ${k.bg}; border-left: 4px solid ${k.border}; border-radius: 6px;">
                    <p style="margin: 0; color: ${k.text}; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                      Priority: ${(a.priority||"NORMAL").toUpperCase()}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `:""}
          
          <!-- Footer -->
          <tr>
            <td style="padding: 32px 24px; background-color: #f9fafb; border-top: 2px solid #e5e7eb;">
              <div style="text-align: center;">
                <p style="margin: 0; color: ${c}; font-size: 16px; font-weight: 600;">
                  <a href="https://www.insightbooksafrica.com" style="color: ${c}; text-decoration: none;">www.insightbooksafrica.com</a>
                </p>
              </div>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `}},"payslip-email":a=>{let b,c="#1e40af",d=a.companyName||a.tenantName||"InsightBooks",e=a.baseUrl||process.env.NEXT_PUBLIC_BASE_URL||"http://213.165.230.139:3000",f=a.tenantLogoUrl;if(f&&""!==f.trim()){let a=f.startsWith("http")?f:`${e}${f}`;b=`<img src="${a}" alt="${d}" style="max-height: 80px; max-width: 250px; height: auto; width: auto; display: block; margin: 0 auto;" />`}else b=`<h1 style="color: ${c}; margin: 0; font-size: 28px; font-weight: 700;">${d}</h1>`;return{subject:a.subject||`Your Payslip for ${a.month} ${a.year} - ${d}`,html:`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payslip - ${a.month} ${a.year}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6; padding: 20px 0;">
    <tr>
      <td align="center" style="padding: 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px 24px; text-align: center; border-bottom: 2px solid #e5e7eb;">
              ${b}
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px; background-color: #ffffff;">
              <h2 style="color: ${c}; margin: 0 0 8px 0; font-size: 24px; font-weight: 700;">Payslip Notification</h2>
              <p style="color: #6b7280; margin: 0 0 24px 0; font-size: 14px;">${a.month} ${a.year}</p>
              
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid ${c};">
                <p style="margin: 0 0 12px 0; color: #374151; font-size: 15px; line-height: 1.6;">
                  Dear <strong>${a.employeeName}</strong>,
                </p>
                <p style="margin: 0 0 12px 0; color: #374151; font-size: 15px; line-height: 1.6;">
                  Your payslip for <strong>${a.month} ${a.year}</strong> is attached to this email.
                </p>
                <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6;">
                  Pay Period: <strong>${a.periodStart}</strong> to <strong>${a.periodEnd}</strong>
                </p>
              </div>
              
              <!-- Summary Box -->
              <div style="background: linear-gradient(135deg, ${c} 0%, #3b82f6 100%); border-radius: 8px; padding: 24px; margin: 24px 0; color: white;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="padding: 8px 0;">
                      <p style="margin: 0; font-size: 13px; opacity: 0.9;">Gross Pay</p>
                      <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: 700;">${a.grossPay}</p>
                    </td>
                    <td style="padding: 8px 0; text-align: right;">
                      <p style="margin: 0; font-size: 13px; opacity: 0.9;">Total Deductions</p>
                      <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: 700;">${a.totalDeductions}</p>
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding: 16px 0 0 0; border-top: 2px solid rgba(255, 255, 255, 0.3);">
                      <p style="margin: 0; font-size: 13px; opacity: 0.9;">Net Pay</p>
                      <p style="margin: 4px 0 0 0; font-size: 28px; font-weight: 700;">${a.netPay}</p>
                    </td>
                  </tr>
                </table>
              </div>
              
              <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Please find your detailed payslip attached as a PDF document. If you have any questions or concerns regarding your payslip, please contact the HR department.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #f9fafb; border-top: 2px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                This is an automated message from ${d}. Please do not reply to this email.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `}}},l=()=>{let a=["EMAIL_HOST","EMAIL_USER","EMAIL_PASSWORD"].filter(a=>!process.env[a]);if(a.length>0)throw Error(`Missing required email environment variables: ${a.join(", ")}`);let b={host:process.env.EMAIL_HOST,port:Number(process.env.EMAIL_PORT),secure:"true"===process.env.EMAIL_SECURE,auth:{user:process.env.EMAIL_USER,pass:process.env.EMAIL_PASSWORD},debug:!0,logger:!0};return"smtp.hostinger.com"===process.env.EMAIL_HOST&&("465"===process.env.EMAIL_PORT?(b.port=465,b.secure=!0,b.requireTLS=!1,b.ignoreTLS=!0):(b.port=587,b.secure=!1,b.requireTLS=!0,b.ignoreTLS=!1),b.tls={rejectUnauthorized:!0},b.authMethod="PLAIN"),console.log("Email transport config:",{host:b.host,port:b.port,secure:b.secure,requireTLS:b.requireTLS,user:b.auth.user}),d.createTransport(b)};async function m(a,b="email"){try{await a.verify(),console.log(`SMTP verify OK (${b})`)}catch(a){console.warn(`SMTP verify() failed (${b}); attempting send anyway:`,a?.message||a)}}function n(a="InsightBooks"){let b=(process.env.EMAIL_FROM||process.env.EMAIL_USER||"").trim();return b?b.includes("<")?b:`"${a}" <${b}>`:`"${a}" <noreply@example.com>`}let o=async({to:a,subject:b,template:c,data:d,from:g,attachments:h=[],htmlContent:i=null,text:j=null})=>{try{let n="string"==typeof a?a.trim():a;if(!n)throw Error("Recipient email is required");let o=b,p=i;if(c&&k[c]){let a={...d,htmlContent:i||d.htmlContent||d.message},e=k[c](a);p=e.html,o=b||e.subject}else if(i)p=i;else throw Error("Either template or htmlContent must be provided");let q=l();await m(q,"sendEmail");let r={from:g||process.env.EMAIL_FROM||'"Company Name" <noreply@example.com>',to:n,subject:o,html:p,...j?{text:j}:{}};if(h&&h.length>0){let a=[];for(let b of h)if(b.path)a.push({filename:b.name,path:b.path,contentType:b.type});else if(b.content)a.push({filename:b.name,content:b.content,contentType:b.type});else if(b.url)try{let c=(0,f.join)(process.cwd(),"public",b.url),d=await (0,e.readFile)(c);a.push({filename:b.name,content:d,contentType:b.type})}catch(a){console.warn(`Could not read attachment ${b.name}:`,a.message)}a.length>0&&(r.attachments=a)}let s=await q.sendMail(r);if(console.log("sendMail result:",{to:n,messageId:s.messageId,accepted:s.accepted,rejected:s.rejected,response:s.response}),Array.isArray(s.rejected)&&s.rejected.length>0)throw Error(`SMTP rejected recipient(s): ${s.rejected.join(", ")}. Server response: ${s.response||"n/a"}`);if(!Array.isArray(s.accepted)||0===s.accepted.length)throw Error(`SMTP accepted no recipients for ${n}. Response: ${s.response||"n/a"}`);return s}catch(a){if(console.error("Error sending email:",a),"EAUTH"===a.code){if(console.error("SMTP Authentication failed. Please check your email credentials."),"true"===process.env.EMAIL_SIMULATE_SUCCESS_ON_EAUTH)return console.warn("EMAIL_SIMULATE_SUCCESS_ON_EAUTH=true: returning fake success (do not use in production)."),{messageId:"fallback-"+Date.now(),status:"simulated",note:"Email delivery simulated due to SMTP authentication failure"};throw Error("SMTP authentication failed (EAUTH). Verify EMAIL_USER, EMAIL_PASSWORD, and that the account is allowed to send mail.")}if("ECONNECTION"===a.code)throw console.error("SMTP Connection failed. Please check your email server settings."),Error("Email connection failed. Please check your email server configuration.");if("ETIMEDOUT"===a.code)throw console.error("SMTP Connection timeout. Please check your email server settings."),Error("Email connection timeout. Please check your email server configuration.");throw a}},p=async(a,b,c,d={})=>{let{customMessage:e="",extraAttachments:f=[],toEmails:g}=d,h=Array.isArray(g)&&g.length>0?g.join(", "):a.client?.email||"";if(!h)throw Error("No recipient email address");console.log("Sending quotation email to:",h);try{let d=l();await m(d,"quotation email");let g=`Dear ${a.client.name},

Please find attached your quotation ${a.quotationNumber}.

Total amount: ${a.total.toLocaleString()}
Valid until: ${a.validUntil.toLocaleDateString()}

${e?e+"\n\n":""}Thank you for your business.

${b.name}`,i=[{filename:`quotation-${a.id}.pdf`,content:c,contentType:"application/pdf"},...f],j="string"==typeof h?h.trim():h,k=await d.sendMail({from:process.env.EMAIL_FROM||'"Company Name" <noreply@example.com>',to:j,subject:`Quotation ${a.quotationNumber} from ${b.name}`,text:g,attachments:i});if(console.log("sendMail (quotation) result:",{to:j,messageId:k.messageId,accepted:k.accepted,rejected:k.rejected,response:k.response}),Array.isArray(k.rejected)&&k.rejected.length>0)throw Error(`SMTP rejected recipient(s): ${k.rejected.join(", ")}. Server response: ${k.response||"n/a"}`);if(!Array.isArray(k.accepted)||0===k.accepted.length)throw Error(`SMTP accepted no recipients for ${j}. Response: ${k.response||"n/a"}`);return k}catch(a){if(console.error("Error sending email:",a),"EAUTH"===a.code){if(console.error("SMTP Authentication failed. Please check your email credentials."),"true"===process.env.EMAIL_SIMULATE_SUCCESS_ON_EAUTH)return console.warn("EMAIL_SIMULATE_SUCCESS_ON_EAUTH=true: returning fake success for quotation (not for production)."),{messageId:"mock-"+Date.now(),status:"simulated",note:"Email delivery simulated due to SMTP authentication failure"};throw Error("SMTP authentication failed (EAUTH). Verify EMAIL_USER and EMAIL_PASSWORD for outbound mail.")}if("ECONNECTION"===a.code)throw console.error("SMTP Connection failed. Please check your email server settings."),Error("Email connection failed. Please check your email server configuration.");if("ETIMEDOUT"===a.code)throw console.error("SMTP Connection timeout. Please check your email server settings."),Error("Email connection timeout. Please check your email server configuration.");throw a}},q=async(a,b,c)=>o({to:a,template:"password-reset-link",data:{name:c,resetLink:b}})}};