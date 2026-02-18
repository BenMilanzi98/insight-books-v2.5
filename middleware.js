import { NextResponse } from 'next/server';

export async function middleware(request) {
  const pathname = request.nextUrl.pathname;

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

  // Redirect old /admin paths to /insightbooks (admin panel moved)
  if (pathname.startsWith('/admin')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/admin/, '/insightbooks');
    return NextResponse.redirect(url);
  }

  // --- /insightbooks: admin-only (not for tenants). Requires admin_token cookie. ---
  if (pathname.startsWith('/insightbooks')) {
    const adminToken = request.cookies.get('admin_token')?.value;
    const isInsightBooksLogin = pathname === '/insightbooks/login';

    if (isInsightBooksLogin) {
      // Allow access to admin login page without admin token
      return NextResponse.next();
    }

    if (!adminToken) {
      const url = request.nextUrl.clone();
      url.pathname = '/insightbooks/login';
      url.search = pathname !== '/insightbooks' ? `?redirect=${encodeURIComponent(pathname)}` : '';
      return NextResponse.redirect(url);
    }

    // Admin token present: allow. No tenant subscription check for insightbooks.
    return NextResponse.next();
  }

  // --- Tenant app: public paths that don't require authentication ---
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

  if (isPublicPath) {
    return NextResponse.next();
  }

  // For all other protected routes (tenant app)
  {
    const sessionCookie = request.cookies.get('session')?.value;

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
          // IMPORTANT:
          // Always call the subscription status endpoint on the SAME ORIGIN as the request.
          // Using APP_URL can point to an unreachable host (e.g. a public IP) in dev / some deployments,
          // causing tenant app to fail even for valid subscribers.
          const apiUrl = new URL('/api/subscription/status', request.nextUrl.origin);
          console.log(`📡 Calling API: ${apiUrl.toString()}`);

          // Call your status API
          const statusRes = await fetch(apiUrl.toString(), {
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
          // Fail-open: if the subscription API is temporarily unreachable, don't break tenant access.
          // This avoids locking users out due to transient network/DNS issues.
          console.error(`⚠️ Subscription check error, allowing request to continue:`, error);
          return NextResponse.next({
            request: {
              headers: requestHeaders,
            },
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
}

// Specify paths that should trigger this middleware
export const config = {
  matcher: [
    '/((?!api|_next|static|favicon.ico|sitemap.xml).*)',
  ],
};
