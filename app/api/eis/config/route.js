import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { hasEISAccess } from '@/lib/subscriptionService';
import { encrypt, decrypt } from '@/lib/encryption';
import prisma from '@/lib/prisma';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const hasEIS = await hasEISAccess(user.tenantId);
    if (!hasEIS) {
      return NextResponse.json({ error: 'EIS subscription required' }, { status: 403 });
    }

    const config = await prisma.eISConfiguration.findFirst({
      where: { tenantId: user.tenantId }
    });

    if (!config) return NextResponse.json({ config: null });

    return NextResponse.json({
      config: {
        id: config.id,
        clientId: config.clientId,
        clientSecret: config.clientSecret ? '***' : null,
        apiKey: config.apiKey ? '***' : null,
        environment: config.environment,
        isActive: config.isActive,
        lastSyncAt: config.lastSyncAt,
        syncStatus: config.syncStatus,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt
      }
    });
  } catch (error) {
    console.error('GET /api/eis/config error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const hasEIS = await hasEISAccess(user.tenantId);
    if (!hasEIS) {
      return NextResponse.json({ error: 'EIS subscription required' }, { status: 403 });
    }

    const body = await request.json();
    const { clientId, clientSecret, apiKey, environment, isActive } = body;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'clientId and clientSecret are required' }, { status: 400 });
    }

    const encryptedSecret = encrypt(clientSecret);
    const encryptedApiKey = apiKey ? encrypt(apiKey) : null;

    await prisma.eISConfiguration.upsert({
      where: { tenantId: user.tenantId },
      update: {
        clientId,
        clientSecret: encryptedSecret,
        apiKey: encryptedApiKey,
        environment: environment || 'sandbox',
        isActive: isActive !== false
      },
      create: {
        tenantId: user.tenantId,
        clientId,
        clientSecret: encryptedSecret,
        apiKey: encryptedApiKey,
        environment: environment || 'sandbox',
        isActive: isActive !== false
      }
    });

    await prisma.tenant.update({
      where: { id: user.tenantId },
      data: { eisEnabled: isActive !== false }
    });

    return NextResponse.json({ success: true, message: 'EIS configuration saved' });
  } catch (error) {
    console.error('POST /api/eis/config error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
