import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  resolveSearchScopes,
  clampSearchLimit,
  sanitizeTenantSearchHit,
  sanitizeUserSearchHit,
  sanitizeAffiliateSearchHit,
} from '@/lib/admin/adminSearch';

/**
 * GET /api/admin/search?q=&limit=
 * Permission-aware platform search. Never returns passwords, tokens, or SMTP secrets.
 * Debounce is client-side; server paginates with take <= 25.
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const take = clampSearchLimit(searchParams.get('limit'));
    const scopes = resolveSearchScopes(admin);

    if (!q) {
      return NextResponse.json({
        success: true,
        q: '',
        limit: take,
        scopes,
        results: { tenants: [], users: [], affiliates: [] },
      });
    }

    const results = { tenants: [], users: [], affiliates: [] };

    if (scopes.tenants) {
      const tenants = await prisma.tenant.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { subdomain: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, subdomain: true, status: true },
        take,
        orderBy: { name: 'asc' },
      });
      results.tenants = tenants.map(sanitizeTenantSearchHit).filter(Boolean);
    }

    if (scopes.users) {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, email: true, name: true },
        take,
        orderBy: { email: 'asc' },
      });
      results.users = users.map(sanitizeUserSearchHit).filter(Boolean);
    }

    if (scopes.affiliates) {
      const affiliates = await prisma.affiliate.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, email: true, referralCode: true },
        take,
        orderBy: { name: 'asc' },
      });
      results.affiliates = affiliates.map(sanitizeAffiliateSearchHit).filter(Boolean);
    }

    return NextResponse.json({
      success: true,
      q,
      limit: take,
      scopes,
      results,
    });
  } catch (error) {
    console.error('admin search error:', error);
    return NextResponse.json(
      { success: false, error: 'Search failed' },
      { status: 500 }
    );
  }
}
