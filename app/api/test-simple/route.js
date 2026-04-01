import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';

async function guard(request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const perm = await requirePermission(request, 'system.view');
  if (perm) return perm;
  return null;
}

export async function DELETE(request) {
  const g = await guard(request);
  if (g) return g;
  return NextResponse.json({ message: 'DELETE working' });
}

export async function POST(request) {
  const g = await guard(request);
  if (g) return g;
  return NextResponse.json({ message: 'POST working' });
}

export async function PUT(request) {
  const g = await guard(request);
  if (g) return g;
  return NextResponse.json({ message: 'PUT working' });
}

export async function GET(request) {
  const g = await guard(request);
  if (g) return g;
  return NextResponse.json({ message: 'GET working' });
}

