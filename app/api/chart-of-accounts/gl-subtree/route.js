import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { canViewChartOfAccounts } from '@/lib/chartOfAccountsAccess';
import {
  fetchGlSubtreePickerList,
  GL_SUBTREE_ROOT_ASSETS,
  GL_SUBTREE_ROOT_LIABILITIES,
} from '@/lib/coaGlSubtreeValidation.js';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required or no tenant associated' }, { status: 401 });
    }
    if (!canViewChartOfAccounts(user)) {
      return NextResponse.json(
        { error: 'Access denied. accounts.view permission required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const rootRaw = String(searchParams.get('root') || '').trim();
    const rootNorm =
      rootRaw === '2000' || rootRaw === GL_SUBTREE_ROOT_LIABILITIES
        ? GL_SUBTREE_ROOT_LIABILITIES
        : GL_SUBTREE_ROOT_ASSETS;

    const accounts = await fetchGlSubtreePickerList(prisma, user.tenantId, rootNorm);
    return NextResponse.json({ root: rootNorm, accounts });
  } catch (error) {
    console.error('gl-subtree GET:', error);
    const message = error?.message || 'Failed to load GL subtree';
    const status = error?.code === 'INVALID_GL_SUBTREE_ROOT' ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
