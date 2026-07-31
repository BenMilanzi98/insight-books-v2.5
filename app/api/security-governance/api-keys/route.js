import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma.js';
import {
  guardSecurityRoute,
  securityErrorResponse,
} from '../../../../lib/securityGovernance/api/routeGuard.js';
import { SECURITY_PERMISSIONS } from '../../../../lib/securityGovernance/permissions.js';
import {
  createApiKey,
  revokeApiKey,
} from '../../../../lib/securityGovernance/application/apiKeyService.js';

export async function GET(request) {
  try {
    const guard = await guardSecurityRoute(request, SECURITY_PERMISSIONS.MANAGE_API_KEYS);
    if (guard.response) return guard.response;
    const keys = await prisma.secV2ApiKey.findMany({
      where: { businessId: guard.context.businessId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        status: true,
        purpose: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ keys });
  } catch (error) {
    return securityErrorResponse(error, 'list api keys');
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const guard = await guardSecurityRoute(request, SECURITY_PERMISSIONS.MANAGE_API_KEYS);
    if (guard.response) return guard.response;
    if (body.action === 'create') {
      const result = await createApiKey(prisma, guard.context, body);
      return NextResponse.json(result);
    }
    if (body.action === 'revoke') {
      const key = await revokeApiKey(prisma, guard.context, body.apiKeyId);
      return NextResponse.json({ key });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return securityErrorResponse(error, 'api key action');
  }
}
