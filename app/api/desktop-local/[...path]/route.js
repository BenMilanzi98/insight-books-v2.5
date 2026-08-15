import { NextResponse } from 'next/server';
import { isDesktopRuntime } from '@/lib/desktop/runtime.js';
import { getUserFromSession } from '@/lib/auth';

export async function GET(request, ctx) {
  return dispatch(request, ctx);
}
export async function POST(request, ctx) {
  return dispatch(request, ctx);
}
export async function PUT(request, ctx) {
  return dispatch(request, ctx);
}
export async function PATCH(request, ctx) {
  return dispatch(request, ctx);
}
export async function DELETE(request, ctx) {
  return dispatch(request, ctx);
}

async function dispatch(request, ctx) {
  // Web/VPS builds must not pull in better-sqlite3 at module load time.
  if (!isDesktopRuntime()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [{ getDesktopDbFromEnv }, { handleDesktopLocal }] = await Promise.all([
    import('@/lib/desktop/sqlite/db.js'),
    import('@/lib/desktop/local/handlers.js'),
  ]);

  const user = await getUserFromSession(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const parts = (await ctx.params).path || [];
  const pathname = `/api/${parts.join('/')}`;
  const body = ['GET', 'HEAD'].includes(request.method)
    ? null
    : await request.json().catch(() => ({}));
  const result = await Promise.resolve(
    handleDesktopLocal({
      db: getDesktopDbFromEnv(),
      method: request.method,
      pathname,
      searchParams: Object.fromEntries(new URL(request.url).searchParams),
      body,
      now: Date.now(),
      user,
      requestCookie: request.headers.get('cookie') || '',
    })
  );
  return NextResponse.json(result.json, { status: result.status });
}
