import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  getActiveHealthDefinition,
  resolveHealthAccess,
  HEALTH_DEFINITION_VERSION,
  V1_NA_DIMENSIONS,
} from '@/lib/admin/health';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const access = resolveHealthAccess(admin);
    if (!access.canView) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const version = searchParams.get('version') || undefined;
    const definition = await getActiveHealthDefinition(prisma, {
      definitionVersion: version,
    });

    return NextResponse.json({
      success: true,
      definition,
      activeVersion: definition.version || HEALTH_DEFINITION_VERSION,
      notApplicableDimensions: V1_NA_DIMENSIONS,
      canManageDefinitions: access.canManageDefinitions,
      disclaimer:
        'Health definition governs explainable scores — not churn or renewal probability.',
    });
  } catch (error) {
    console.error('customer-health definitions error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load health definitions' },
      { status: 500 }
    );
  }
}
