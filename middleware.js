import { NextResponse } from 'next/server';
import { parseSessionPayloadEdge } from '@/lib/sessionCookieEdge';
import { isApiPublicPath } from '@/lib/tenantApiAccess';
import { evaluateCutoverAccess } from '@/lib/productionCutover/modes';
import { DESKTOP_COOKIE, isDesktopCookie } from '@/lib/desktop/runtime';
import { resolveDesktopApiMiddleware } from '@/lib/desktop/middlewareClassify';

async function finishTenantRouteAccess(request, sessionCookie, pathname, requestHeaders) {
  try {
    const guardUrl = new URL('/api/auth/page-guard', request.nextUrl.origin);
    guardUrl.searchParams.set('path', pathname);
    const gr = await fetch(guardUrl.toString(), {
      headers: { cookie: `session=${sessionCookie}` },
      cache: 'no-store',
    });
    if (gr.ok) {
      const j = await gr.json();
      if (j.allowed === false) {
        const dest =
          typeof j.redirect === 'string' && j.redirect.startsWith('/') ? j.redirect : '/dashboard';
        if (dest !== pathname) {
          const url = request.nextUrl.clone();
          url.pathname = dest;
          url.search = '';
          return NextResponse.redirect(url, { request: { headers: requestHeaders } });
        }
      }
    }
  } catch (e) {
    console.warn('page-guard middleware fetch failed:', e?.message || e);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

async function finishApiRouteAccess(request, sessionCookie, pathname, requestHeaders) {
  if (isApiPublicPath(pathname) || pathname === '/api/auth/api-guard') {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }
  try {
    const guardUrl = new URL('/api/auth/api-guard', request.nextUrl.origin);
    guardUrl.searchParams.set('path', pathname);
    const gr = await fetch(guardUrl.toString(), {
      headers: { cookie: `session=${sessionCookie}` },
      cache: 'no-store',
    });
    if (!gr.ok) {
      return NextResponse.json({ error: 'Permission denied' }, { status: gr.status || 403 });
    }
    const j = await gr.json();
    if (j.allowed === false) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
  } catch (e) {
    console.warn('api-guard middleware fetch failed:', e?.message || e);
    return NextResponse.json({ error: 'Authorization guard failed' }, { status: 500 });
  }
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function middleware(request) {
  const pathname = request.nextUrl.pathname;
  const isDesktop = isDesktopCookie(request.cookies.get(DESKTOP_COOKIE)?.value);

  // Skip middleware for static files, api routes, etc.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/uploads') ||
    pathname === '/favicon.ico' ||
    pathname === '/logo.png' ||
    pathname === '/sitemap.xml'
  ) {
    return NextResponse.next();
  }

  // Phase 18 — server-enforced cutover / maintenance / write freeze (CUTOVER_MODE)
  if (!isDesktop) {
    const cutover = evaluateCutoverAccess({
      pathname,
      method: request.method,
    });
    if (!cutover.allow) {
      if (pathname.startsWith('/api')) {
        return NextResponse.json(
          {
            error: cutover.message,
            code: cutover.code,
            mode: cutover.mode,
            retryable: true,
          },
          { status: cutover.status || 503 }
        );
      }
      if (pathname !== '/maintenance') {
        const url = request.nextUrl.clone();
        url.pathname = '/maintenance';
        url.search = '';
        return NextResponse.redirect(url);
      }
    }
  }

  if (pathname.startsWith('/api')) {
    const sessionCookie = request.cookies.get('session')?.value;
    const requestHeaders = new Headers(request.headers);
    if (!sessionCookie && !isApiPublicPath(pathname)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!sessionCookie) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    if (isDesktop) {
      const resolved = resolveDesktopApiMiddleware(pathname);
      if (resolved.action === 'respond') {
        return NextResponse.json(resolved.body, { status: resolved.status });
      }
      if (resolved.action === 'rewrite') {
        const url = request.nextUrl.clone();
        url.pathname = resolved.pathname;
        return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
      }
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    return finishApiRouteAccess(request, sessionCookie, pathname, requestHeaders);
  }

  // Redirect old /admin paths to /insightbooks (admin panel moved)
  if (pathname.startsWith('/admin')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/admin/, '/insightbooks');
    return NextResponse.redirect(url);
  }

  // --- /insightbooks: admin-only. Requires valid admin JWT (not cookie presence alone). ---
  if (pathname.startsWith('/insightbooks')) {
    const { verifyAdminJwtEdge } = await import('@/lib/admin/authorization/verifyAdminJwtEdge');
    const adminToken = request.cookies.get('admin_token')?.value;
    const isInsightBooksLogin = pathname === '/insightbooks/login';

    if (isInsightBooksLogin) {
      return NextResponse.next();
    }

    if (!adminToken) {
      const url = request.nextUrl.clone();
      url.pathname = '/insightbooks/login';
      url.search = pathname !== '/insightbooks' ? `?redirect=${encodeURIComponent(pathname)}` : '';
      return NextResponse.redirect(url);
    }

    const verified = await verifyAdminJwtEdge(adminToken);
    if (!verified.ok) {
      const url = request.nextUrl.clone();
      url.pathname = '/insightbooks/login';
      url.search = `?redirect=${encodeURIComponent(pathname)}&reason=session`;
      const res = NextResponse.redirect(url);
      res.cookies.set('admin_token', '', { httpOnly: true, path: '/', maxAge: 0 });
      return res;
    }

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
    pathname === '/maintenance' ||
    pathname === '/contact' ||
    pathname === '/terms' ||
    pathname === '/privacy' ||
    pathname === '/download-app' ||
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

    if (isDesktop) {
      try {
        const sessionData = await parseSessionPayloadEdge(sessionCookie);
        if (!sessionData) {
          throw new Error('Invalid session');
        }

        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-user-id', sessionData.userId);
        requestHeaders.set('x-user-role', sessionData.role || '');

        return NextResponse.next({ request: { headers: requestHeaders } });
      } catch (error) {
        console.error('Invalid session, redirecting to login:', error);
        const url = request.nextUrl.clone();
        url.pathname = '/auth/login';
        const res = NextResponse.redirect(url);
        res.cookies.set('session', '', { path: '/', maxAge: 0 });
        return res;
      }
    }
    
    try {
      const sessionData = await parseSessionPayloadEdge(sessionCookie);
      if (!sessionData) {
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

            // Session parse failures on the status API return HTTP 200 with error + isActive:false.
            // Do not treat that as "no subscription" — fail open so login works with v2 cookies.
            if (statusData?.error && !statusData?.user) {
              console.warn(
                `⚠️ Subscription status returned auth/session error; allowing request:`,
                statusData.error
              );
              return finishTenantRouteAccess(request, sessionCookie, pathname, requestHeaders);
            }

            const hasAccess =
              statusData.subscription?.isActive ||
              statusData.subscription?.hasActiveSubscription ||
              statusData.subscriptionStatus?.isActive ||
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
          return finishTenantRouteAccess(request, sessionCookie, pathname, requestHeaders);
        }
      }

      return finishTenantRouteAccess(request, sessionCookie, pathname, requestHeaders);
    } catch (error) {
      console.error('Invalid session, redirecting to login:', error);
      // Invalid session - redirect to login and clear bad cookie
      const url = request.nextUrl.clone();
      url.pathname = '/auth/login';
      const res = NextResponse.redirect(url);
      res.cookies.set('session', '', { path: '/', maxAge: 0 });
      return res;
    }
  }
}

// Specify paths that should trigger this middleware
export const config = {
  matcher: [
    '/((?!_next|static|favicon.ico|sitemap.xml).*)',
  ],
};
