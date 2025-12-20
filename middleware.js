import { NextResponse } from 'next/server';

export async function middleware(request) {
  const pathname = request.nextUrl.pathname;
  
  // Public paths that don't require authentication
  const isPublicPath = 
    pathname === '/' || 
    pathname === '/auth/login' || 
    pathname === '/auth/signup' || 
    pathname === '/auth/forgot-password' ||
    pathname === '/auth/reset-password' ||
    pathname === '/suspended' ||
    pathname === '/contact' ||
    pathname === '/terms' ||
    pathname === '/privacy' ||
    pathname.startsWith('/auth/');
  
  // Skip middleware for static files, api routes, etc.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/uploads') ||
    pathname === '/favicon.ico' ||
    pathname === '/logo.png' ||
    pathname === '/sitemap.xml'
  ) {
    return NextResponse.next();
  }
  
  // For all protected routes (not public paths)
  if (!isPublicPath) {
    // Get session from cookies
    const sessionCookie = request.cookies.get('session')?.value;
    
    // If no session, redirect to login
    if (!sessionCookie) {
      console.log('No session cookie found, redirecting to login');
      const url = request.nextUrl.clone();
      url.pathname = '/auth/login';
      url.search = `?redirect=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
    
    try {
      // Validate session (basic check)
      const sessionData = JSON.parse(Buffer.from(sessionCookie, 'base64').toString());

      // Check if session contains required data
      if (!sessionData.userId) {
        throw new Error('Invalid session');
      }

      // Session valid - continue with headers
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', sessionData.userId);
      requestHeaders.set('x-user-role', sessionData.role || '');

      // These paths are allowed even without active subscription
      const allowedWithoutSubscription = [
        '/subscription',
        '/switch-tenant',
        '/profile',
        '/account',
        '/auth/logout'
      ];

      const isAllowed = allowedWithoutSubscription.some(path => pathname.startsWith(path));

      if (!isAllowed) {
        console.log(`🔍 Checking subscription for path: ${pathname}`);

        try {
          // Build the API URL using APP_URL from environment variables
          // FIXED: Use APP_URL from .env for consistent URL construction
          const baseUrl = process.env.APP_URL || request.nextUrl.origin;
          const apiUrl = `${baseUrl}/api/subscription/status`;
          console.log(`📡 Calling API: ${apiUrl}`);

          // Call your status API
          const statusRes = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              cookie: `session=${sessionCookie}`
            }
          });

          console.log(`📊 API Response Status: ${statusRes.status}`);

          if (statusRes.ok) {
            const statusData = await statusRes.json();
            console.log(`📊 API Response Data:`, JSON.stringify(statusData, null, 2));

            // FIXED: Check for active subscription OR active trial
            const hasAccess = statusData.subscription?.isActive || 
                            (statusData.isTrialActive && statusData.remainingTrialDays > 0);
            
   

            if (!hasAccess) {
              console.log(`❌ No access, redirecting to subscription page`);
              // No active subscription or trial → redirect to subscription
              const url = request.nextUrl.clone();
              url.pathname = '/subscription';
              // Add a query parameter to indicate why they were redirected
              url.search = '?redirected=true&reason=no_subscription';
              return NextResponse.redirect(url, {
                request: { headers: requestHeaders }
              });
            }
          } else {
            const url = request.nextUrl.clone();
            url.pathname = '/subscription';
            url.search = '?redirected=true&reason=api_error';
            return NextResponse.redirect(url, {
              request: { headers: requestHeaders }
            });
          }

          console.log(`✅ Access granted, continuing to ${pathname}`);
        } catch (error) {
          // If subscription check fails, redirect to subscription page as a safety measure
          console.error(`⚠️ Subscription check error, redirecting to subscription page:`, error);
          const url = request.nextUrl.clone();
          url.pathname = '/subscription';
          url.search = '?redirected=true&reason=check_error';
          return NextResponse.redirect(url, {
            request: { headers: requestHeaders }
          });
        }
      }

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    } catch (error) {
      console.error('Invalid session, redirecting to login:', error);
      // Invalid session - redirect to login
      const url = request.nextUrl.clone();
      url.pathname = '/auth/login';
      return NextResponse.redirect(url);
    }
  }
  
  // Continue for public paths
  return NextResponse.next();
}

// Specify paths that should trigger this middleware
export const config = {
  matcher: [
    '/((?!api|_next|static|favicon.ico|sitemap.xml).*)',
  ],
};
