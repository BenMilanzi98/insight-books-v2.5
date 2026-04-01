import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';

export async function DELETE(request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const perm = await requirePermission(request, 'system.view');
  if (perm) return perm;

  return NextResponse.json({ message: 'DELETE method working' });
}

export async function GET(request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const perm = await requirePermission(request, 'system.view');
  if (perm) return perm;

  return NextResponse.json({ message: 'GET method working' });
}

