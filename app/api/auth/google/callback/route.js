import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { OAuth2Client } from 'google-auth-library';
import prisma from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { generateFullPermissions } from '@/lib/permissionsMap';
import { initializeTenantTrial } from '@/lib/subscriptionService';

export async function GET(request) {
  try {
    // Check for required environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      console.error('Google OAuth Callback: Missing required environment variables');
      return NextResponse.redirect(
        `${process.env.APP_URL || 'http://localhost:3000'}/auth/signup?error=oauth_config_missing`
      );
    }

    // Set up redirect URI
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 
      `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/google/callback`;

    // Initialize Google OAuth client with timeout configuration
    const googleClient = new OAuth2Client(clientId, clientSecret, redirectUri);

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    
    // Check for OAuth errors from Google
    if (error) {
      console.error('Google OAuth error:', error);
      return NextResponse.redirect(
        `${process.env.APP_URL || 'http://localhost:3000'}/auth/signup?error=oauth_denied&details=${encodeURIComponent(error)}`
      );
    }
    
    if (!code) {
      console.error('Google OAuth Callback: No authorization code received');
      return NextResponse.redirect(
        `${process.env.APP_URL || 'http://localhost:3000'}/auth/signup?error=oauth_no_code`
      );
    }

    // Decode state to get mode
    let mode = 'signup';
    try {
      if (state) {
        const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
        mode = decodedState.mode || 'signup';
      }
    } catch (error) {
      console.error('Error decoding state:', error);
    }

    console.log('Google OAuth Callback: Processing authorization code');
    console.log('Mode:', mode);
    console.log('Code length:', code.length);
    console.log('Redirect URI:', redirectUri);

    // Exchange code for tokens with timeout and retry logic
    let tokens;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        console.log(`Attempting token exchange (attempt ${retryCount + 1}/${maxRetries})`);
        
        // Add more detailed logging
        console.log('Token exchange parameters:');
        console.log('- Client ID:', clientId ? 'Set' : 'Missing');
        console.log('- Client Secret:', clientSecret ? 'Set' : 'Missing');
        console.log('- Redirect URI:', redirectUri);
        console.log('- Authorization Code:', code ? `Length: ${code.length}` : 'Missing');
        
        // Use direct fetch instead of Google OAuth library
        tokens = await manualTokenExchange(code, clientId, clientSecret, redirectUri);
        
        console.log('Token exchange successful');
        console.log('Access token received:', tokens.access_token ? 'Yes' : 'No');
        break;
      } catch (tokenError) {
        retryCount++;
        console.error(`Token exchange attempt ${retryCount} failed:`, tokenError.message);
        console.error('Error details:', {
          code: tokenError.code,
          status: tokenError.status,
          response: tokenError.response?.data
        });
        
        if (retryCount >= maxRetries) {
          // Try curl-based approach as final fallback
          console.log('Attempting curl-based token exchange as final fallback...');
          try {
            const curlTokens = await curlTokenExchange(code, clientId, clientSecret, redirectUri);
            if (curlTokens) {
              tokens = curlTokens;
              console.log('Curl-based token exchange successful');
              break;
            }
          } catch (curlError) {
            console.error('Curl-based token exchange also failed:', curlError.message);
          }
          
          throw new Error(`Token exchange failed after ${maxRetries} attempts: ${tokenError.message}`);
        }
        
        // Wait before retrying (exponential backoff)
        const waitTime = 1000 * retryCount;
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    if (!tokens) {
      throw new Error('Failed to obtain tokens from Google');
    }

    googleClient.setCredentials(tokens);

    // Get user info from Google with timeout
    console.log('Fetching user info from Google...');
    
    // Use https module for user info fetch as well
    const userInfoResponse = await fetchUserInfo(tokens.access_token);

    if (!userInfoResponse.success) {
      throw new Error(`Failed to fetch user info from Google: ${userInfoResponse.error}`);
    }

    const googleUser = userInfoResponse.data;
    console.log('Google User Info:', { email: googleUser.email, name: googleUser.name });
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: googleUser.email },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            status: true
          }
        }
      }
    });

    if (existingUser) {
      // User exists - handle login
      if (!existingUser.isActive) {
        return NextResponse.redirect(
          `${process.env.APP_URL || 'http://localhost:3000'}/auth/login?error=account_deactivated`
        );
      }

      if (existingUser.tenantId && existingUser.tenant?.status !== 'active') {
        return NextResponse.redirect(
          `${process.env.APP_URL || 'http://localhost:3000'}/auth/login?error=tenant_suspended`
        );
      }

      // Create session data
      const sessionData = {
        userId: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
        role: existingUser.role,
        tenantId: existingUser.tenantId
      };

      const session = Buffer.from(JSON.stringify(sessionData)).toString('base64');
      cookies().set('session', session, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      });

      console.log('Google OAuth: Existing user logged in successfully');
      return NextResponse.redirect(
        `${process.env.APP_URL || 'http://localhost:3000'}/dashboard`
      );
    } else {
      // User doesn't exist - handle signup
      if (mode === 'login') {
        return NextResponse.redirect(
          `${process.env.APP_URL || 'http://localhost:3000'}/auth/login?error=account_not_found`
        );
      }

      // Create new user with Google OAuth data
      const result = await handleGoogleSignup(googleUser);
      
      if (result.success) {
        // Create session data
        const sessionData = {
          userId: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          tenantId: result.user.tenantId
        };

        const session = Buffer.from(JSON.stringify(sessionData)).toString('base64');
        cookies().set('session', session, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7 // 7 days
        });

        console.log('Google OAuth: New user created successfully');
        return NextResponse.redirect(
          `${process.env.APP_URL || 'http://localhost:3000'}/auth/business-setup?userId=${result.user.id}&tenantId=${result.user.tenantId}`
        );
      } else {
        console.error('Google OAuth: Signup failed:', result.error);
        return NextResponse.redirect(
          `${process.env.APP_URL || 'http://localhost:3000'}/auth/signup?error=signup_failed&details=${encodeURIComponent(result.error)}`
        );
      }
    }
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'OAuth callback failed';
    if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Network timeout - please check your internet connection and try again';
    } else if (error.message.includes('invalid_grant')) {
      errorMessage = 'Authorization code expired or invalid - please try signing in again';
    } else if (error.message.includes('redirect_uri_mismatch')) {
      errorMessage = 'OAuth configuration error - redirect URI mismatch';
    }
    
    return NextResponse.redirect(
      `${process.env.APP_URL || 'http://localhost:3000'}/auth/signup?error=oauth_callback_failed&details=${encodeURIComponent(errorMessage)}`
    );
  }
}

async function manualTokenExchange(code, clientId, clientSecret, redirectUri) {
  try {
    console.log('Attempting manual token exchange...');
    
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const tokenData = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri
    });

    console.log('Token exchange request details:');
    console.log('- URL:', tokenUrl);
    console.log('- Client ID:', clientId);
    console.log('- Redirect URI:', redirectUri);
    console.log('- Code length:', code.length);

    // Use https module instead of fetch
    const https = require('https');
    const url = require('url');
    
    const postData = tokenData.toString();
    const parsedUrl = url.parse(tokenUrl);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'InsightBooks/1.0',
        'Connection': 'close'
      },
      timeout: 30000, // Increased timeout to 30 seconds
      keepAlive: false, // Disable keep-alive
      rejectUnauthorized: true,
      // Add more robust connection settings
      family: 4, // Force IPv4
      lookup: (hostname, options, callback) => {
        // Use DNS lookup with timeout
        const dns = require('dns');
        dns.lookup(hostname, { family: 4 }, callback);
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          console.log('Token exchange response status:', res.statusCode);
          console.log('Token exchange response:', responseData.substring(0, 500));
          
          if (res.statusCode !== 200) {
            console.error('Manual token exchange failed:', res.statusCode, responseData);
            
            // Check for specific Google OAuth policy errors
            if (responseData.includes("doesn't comply with Google's OAuth 2.0 policy")) {
              reject(new Error('Google OAuth policy compliance issue. Please check your Google Cloud Console configuration.'));
              return;
            }
            
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
            return;
          }
          
          try {
            const tokens = JSON.parse(responseData);
            console.log('Manual token exchange successful');
            
            resolve({
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              scope: tokens.scope,
              token_type: tokens.token_type,
              expiry_date: tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : null
            });
          } catch (parseError) {
            reject(new Error(`Failed to parse response: ${parseError.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        console.error('Manual token exchange request error:', error.message);
        reject(error);
      });
      
      req.on('timeout', () => {
        console.error('Manual token exchange timeout');
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.write(postData);
      req.end();
    });
  } catch (error) {
    console.error('Manual token exchange error:', error.message);
    throw error;
  }
}

async function curlTokenExchange(code, clientId, clientSecret, redirectUri) {
  try {
    console.log('Attempting curl-based token exchange...');
    
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const tokenData = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri
    }).toString();
    
    const curlCommand = `curl -s -w "HTTPSTATUS:%{http_code}" -X POST https://oauth2.googleapis.com/token \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "${tokenData}" \
      --connect-timeout 10 \
      --max-time 30`;
    
    console.log('Executing curl command...');
    const { stdout, stderr } = await execAsync(curlCommand, { timeout: 35000 });
    
    if (stderr) {
      console.error('Curl stderr:', stderr);
    }
    
    // Parse the response
    const httpStatusMatch = stdout.match(/HTTPSTATUS:(\d+)/);
    const responseBody = stdout.replace(/HTTPSTATUS:\d+/, '').trim();
    
    if (httpStatusMatch) {
      const statusCode = parseInt(httpStatusMatch[1]);
      console.log('Curl response status:', statusCode);
      console.log('Curl response body:', responseBody.substring(0, 500));
      
      if (statusCode !== 200) {
        if (responseBody.includes("doesn't comply with Google's OAuth 2.0 policy")) {
          throw new Error('Google OAuth policy compliance issue. Please check your Google Cloud Console configuration.');
        }
        throw new Error(`HTTP ${statusCode}: ${responseBody}`);
      }
      
      try {
        const tokens = JSON.parse(responseBody);
        console.log('Curl-based token exchange successful');
        
        return {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          scope: tokens.scope,
          token_type: tokens.token_type,
          expiry_date: tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : null
        };
      } catch (parseError) {
        throw new Error(`Failed to parse curl response: ${parseError.message}`);
      }
    } else {
      throw new Error('Invalid curl response format');
    }
  } catch (error) {
    console.error('Curl-based token exchange error:', error.message);
    throw error;
  }
}

async function fetchUserInfo(accessToken) {
  try {
    const https = require('https');
    const url = require('url');
    
    const userInfoUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';
    const parsedUrl = url.parse(userInfoUrl);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'InsightBooks/1.0',
        'Connection': 'close'
      },
      timeout: 10000,
      keepAlive: false,
      family: 4
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode !== 200) {
            resolve({
              success: false,
              error: `HTTP ${res.statusCode}: ${responseData}`
            });
            return;
          }
          
          try {
            const userData = JSON.parse(responseData);
            resolve({
              success: true,
              data: userData
            });
          } catch (parseError) {
            resolve({
              success: false,
              error: `Failed to parse response: ${parseError.message}`
            });
          }
        });
      });
      
      req.on('error', (error) => {
        // Try curl fallback
        console.log('HTTPS request failed, trying curl fallback for user info...');
        curlFetchUserInfo(accessToken).then(resolve).catch(() => {
          resolve({
            success: false,
            error: error.message
          });
        });
      });
      
      req.on('timeout', () => {
        req.destroy();
        // Try curl fallback
        console.log('HTTPS request timeout, trying curl fallback for user info...');
        curlFetchUserInfo(accessToken).then(resolve).catch(() => {
          resolve({
            success: false,
            error: 'Request timeout'
          });
        });
      });
      
      req.end();
    });
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function curlFetchUserInfo(accessToken) {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const curlCommand = `curl -s -w "HTTPSTATUS:%{http_code}" -H "Authorization: Bearer ${accessToken}" \
      https://www.googleapis.com/oauth2/v2/userinfo \
      --connect-timeout 10 \
      --max-time 30`;
    
    const { stdout, stderr } = await execAsync(curlCommand, { timeout: 35000 });
    
    if (stderr) {
      console.error('Curl user info stderr:', stderr);
    }
    
    const httpStatusMatch = stdout.match(/HTTPSTATUS:(\d+)/);
    const responseBody = stdout.replace(/HTTPSTATUS:\d+/, '').trim();
    
    if (httpStatusMatch) {
      const statusCode = parseInt(httpStatusMatch[1]);
      
      if (statusCode !== 200) {
        return {
          success: false,
          error: `HTTP ${statusCode}: ${responseBody}`
        };
      }
      
      try {
        const userData = JSON.parse(responseBody);
        return {
          success: true,
          data: userData
        };
      } catch (parseError) {
        return {
          success: false,
          error: `Failed to parse curl response: ${parseError.message}`
        };
      }
    } else {
      return {
        success: false,
        error: 'Invalid curl response format'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function handleGoogleSignup(googleUser) {
  try {
    // Extract name parts
    const nameParts = googleUser.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    // Generate business name from email domain or use a default
    const emailDomain = googleUser.email.split('@')[1];
    const businessName = 'My Business'; // Use generic default instead of email-based name
    
    // Generate subdomain from email domain or use a generic one
    let subdomain = emailDomain ? emailDomain.split('.')[0] : 'mybusiness';
    subdomain = subdomain
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20);

    // Check if subdomain exists, add random number if it does
    const existingTenant = await prisma.tenant.findUnique({
      where: { subdomain }
    });

    if (existingTenant) {
      subdomain = `${subdomain}${Math.floor(Math.random() * 1000)}`;
    }

    // Create tenant, roles and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: businessName,
          subdomain,
          status: 'active',
          subscriptionPlan: '1month', // Add default subscription plan
          settings: {}
        }
      });

      // Create tenant settings
      await tx.tenantSettings.create({
        data: {
          tenantId: tenant.id,
          currencyCode: 'MWK', // Malawian Kwacha based on the pricing in the UI
          taxEnabled: true,
          defaultTaxRate: 0,
          invoicePrefix: 'INV',
          enabledModules: ['invoicing', 'clients', 'expenses', 'inventory', 'hr']
        }
      });

      // Create default roles for the tenant
      const adminRole = await tx.role.upsert({
        where: {
          name_tenantId: {
            name: 'Admin',
            tenantId: tenant.id
          }
        },
        update: {
          permissions: generateFullPermissions()
        },
        create: {
          name: 'Admin',
          description: 'Full access to all tenant features',
          tenantId: tenant.id,
          permissions: generateFullPermissions()
        }
      });

      const employeeRole = await tx.role.upsert({
        where: {
          name_tenantId: {
            name: 'Employee',
            tenantId: tenant.id
          }
        },
        update: {
          permissions: {
            "dashboard": { "view": true },
            "clients": { "view": true, "create": true, "edit": true },
            "invoices": { "view": true, "create": true, "edit": true },
            "expenses": { "view": true, "create": true },
            "reports": { "view": true }
          }
        },
        create: {
          name: 'Employee',
          description: 'Limited access for regular employees',
          tenantId: tenant.id,
          permissions: {
            "dashboard": { "view": true },
            "clients": { "view": true, "create": true, "edit": true },
            "invoices": { "view": true, "create": true, "edit": true },
            "expenses": { "view": true, "create": true },
            "reports": { "view": true }
          }
        }
      });

      // Initialize default payment accounts
      const { initializeDefaultPaymentAccounts } = await import('@/lib/paymentAccountInitialization');
      await initializeDefaultPaymentAccounts(tenant.id, tx);

      // Create user with Google OAuth data
      const user = await tx.user.create({
        data: {
          name: googleUser.name,
          email: googleUser.email,
          password: await bcrypt.hash(Math.random().toString(36), 10), // Random password for OAuth users
          phone: '', // Will be filled later
          isActive: true,
          isEmailVerified: true, // Google emails are verified
          tenantId: tenant.id,
          roleId: adminRole.id, // Updated to use adminRole
          authProvider: 'google',
          authProviderId: googleUser.id,
          profilePicture: googleUser.picture,
          tenants: {
            connect: { id: tenant.id }
          }
        },
        include: {
          role: true,
          tenant: true
        }
      });

      return { user, tenant };
    });

    // Initialize trial for the new tenant
    await initializeTenantTrial(result.tenant.id);

    return { success: true, user: result.user };
  } catch (error) {
    console.error('Google signup error:', error);
    return { success: false, error: error.message };
  }
} 