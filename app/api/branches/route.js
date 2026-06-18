import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';

/** Branches are internal-only; tenant users must not list or create them. */
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ success: true, branches: [] });
  } catch (error) {
    console.error('Error listing branches:', error);
    return NextResponse.json({ error: error.message || 'Failed to list branches' }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'Branch management is not available. Each business uses a single internal location.' },
    { status: 403 }
  );
}







