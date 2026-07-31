import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import {
  getMraBlockUnblockContractDecision,
  getRestrictionSourceRegistry,
  ingestRestriction,
  listActiveRestrictions,
  buildTerminalComplianceProjection,
  evaluateEffectiveComplianceCapabilities,
  createUnblockRequest,
  submitUnblockEvidence,
  approveUnblockRequest,
  queryUnblockStatus,
  applyClearanceAndRevalidate,
  activatePlatformEmergencyPause,
  clearPlatformEmergencyPause,
  classifyPendingOnlineWork,
  classifyPendingOfflineWork,
  COMPLIANCE_OPERATION,
  RESTRICTION_SOURCE,
  RESTRICTION_SCOPE,
  RestrictionErrors,
} from '@/lib/mraEis';
import { MraEisControlError } from '@/lib/mraEis/domain/errors.js';

function errResponse(error) {
  if (error instanceof MraEisControlError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          requiredAction: error.requiredAction,
        },
      },
      { status: error.httpStatus || 400 }
    );
  }
  return NextResponse.json({ error: error.message || 'Restriction error' }, { status: 500 });
}

export async function GET(request) {
  const user = await getUserFromSession(request);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const terminalId = searchParams.get('terminalId');
  const environment = searchParams.get('environment') || 'SANDBOX';
  const useMemory = process.env.MRA_EIS_RESTRICTION_MEMORY === '1' || process.env.MRA_EIS_USE_MOCK === '1';

  const restrictions = await listActiveRestrictions({
    tenantId: user.tenantId,
    businessId: user.tenantId,
    terminalId,
    environment,
    useMemory,
  });

  const projection = terminalId
    ? await buildTerminalComplianceProjection({
        tenantId: user.tenantId,
        businessId: user.tenantId,
        terminalId,
        environment,
        useMemory,
      })
    : null;

  return NextResponse.json({
    contracts: getMraBlockUnblockContractDecision(),
    sources: getRestrictionSourceRegistry(),
    restrictions: restrictions.map((r) => ({
      id: r.id,
      reasonCode: r.reasonCode,
      sourceType: r.sourceType,
      scopeType: r.scopeType,
      scopeId: r.scopeId,
      environment: r.environment,
      state: r.state,
      severity: r.severity,
      terminalId: r.terminalId,
      clearAuthority: r.clearAuthority,
      detectedAt: r.detectedAt,
    })),
    projection,
    note: 'Multiple restrictions may coexist. Clearing one does not clear others. Production MRA unblock calls remain blocked until verified.',
  });
}

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const action = body.action;
    const tenantId = user.tenantId;
    const businessId = user.tenantId;
    const useMemory = process.env.MRA_EIS_RESTRICTION_MEMORY === '1' || process.env.MRA_EIS_USE_MOCK === '1';

    // Reject client force-clear / direct ACTIVE / credential fields
    if (
      body.setTerminalActive ||
      body.clearAllRestrictions ||
      body.forceClearMra ||
      body.jwt ||
      body.privateKey ||
      body.terminalSecret ||
      body.buyerAuthorizationCode
    ) {
      return NextResponse.json(
        {
          error: {
            code: 'CLIENT_RESTRICTION_FIELDS_REJECTED',
            message:
              'Client cannot set Terminal ACTIVE, clear all/MRA restrictions, or supply credentials/BAC.',
          },
        },
        { status: 400 }
      );
    }

    if (action === 'ingest') {
      const result = await ingestRestriction({
        tenantId,
        businessId,
        terminalId: body.terminalId || null,
        environment: body.environment || 'SANDBOX',
        sourceType: body.sourceType || RESTRICTION_SOURCE.SYSTEM_ADMINISTRATOR,
        sourceReference: body.sourceReference || `manual:${Date.now()}`,
        reasonCode: body.reasonCode,
        scopeType: body.scopeType || RESTRICTION_SCOPE.TERMINAL,
        scopeId: body.scopeId || body.terminalId || tenantId,
        evidence: { safe: body.evidenceSafe || { note: body.reason || 'manual ingest' } },
        useMemory,
      });
      return NextResponse.json(result);
    }

    if (action === 'evaluate-capability') {
      const restrictions = await listActiveRestrictions({
        tenantId,
        businessId,
        terminalId: body.terminalId,
        environment: body.environment || 'SANDBOX',
        useMemory,
      });
      return NextResponse.json(
        evaluateEffectiveComplianceCapabilities({
          tenantId,
          businessId,
          terminalId: body.terminalId,
          environment: body.environment || 'SANDBOX',
          requestedOperation: body.requestedOperation || COMPLIANCE_OPERATION.FINALIZE_EIS_SALE,
          restrictions,
        })
      );
    }

    if (action === 'projection') {
      return NextResponse.json(
        await buildTerminalComplianceProjection({
          tenantId,
          businessId,
          terminalId: body.terminalId,
          environment: body.environment || 'SANDBOX',
          useMemory,
        })
      );
    }

    if (action === 'create-unblock-request') {
      const restrictions = await listActiveRestrictions({
        tenantId,
        businessId,
        terminalId: body.terminalId,
        environment: body.environment || 'SANDBOX',
        useMemory,
      });
      const restriction = restrictions.find((r) => r.id === body.restrictionId) || restrictions[0];
      if (!restriction) throw RestrictionErrors.operationBlocked({ message: 'No active restriction.' });
      return NextResponse.json(
        createUnblockRequest({
          tenantId,
          businessId,
          terminalId: body.terminalId || restriction.terminalId,
          environment: body.environment || 'SANDBOX',
          restriction,
          requestedBy: user.id,
          reason: body.reason || '',
          supportingEvidence: body.supportingEvidence || {},
          mraSupportReference: body.mraSupportReference || null,
        })
      );
    }

    if (action === 'submit-unblock-evidence') {
      return NextResponse.json(
        submitUnblockEvidence({
          tenantId,
          businessId,
          requestId: body.requestId,
          evidence: body.evidence || {},
        })
      );
    }

    if (action === 'approve-unblock-request') {
      return NextResponse.json(
        approveUnblockRequest({
          tenantId,
          businessId,
          requestId: body.requestId,
          approverId: user.id,
          requesterId: body.requesterId || null,
        })
      );
    }

    if (action === 'query-unblock-status') {
      return NextResponse.json(
        await queryUnblockStatus({
          tenantId,
          businessId,
          requestId: body.requestId,
          mockScenario: body.mockScenario || 'REVIEW_PENDING',
          useMemory,
        })
      );
    }

    if (action === 'apply-clearance-revalidate') {
      return NextResponse.json(
        await applyClearanceAndRevalidate({
          tenantId,
          businessId,
          requestId: body.requestId,
          actorId: user.id,
          revalidationOverrides: body.revalidationOverrides || {},
          useMemory,
        })
      );
    }

    if (action === 'emergency-pause-activate') {
      if (!user.isSuperAdmin && !user.isSystemAdmin) {
        return NextResponse.json({ error: 'Elevated permission required' }, { status: 403 });
      }
      return NextResponse.json(
        await activatePlatformEmergencyPause({
          environment: body.environment || 'PRODUCTION',
          reasonDetail: body.reasonDetail || 'OTHER_APPROVED_REASON',
          actorId: user.id,
          useMemory,
        })
      );
    }

    if (action === 'emergency-pause-clear') {
      if (!user.isSuperAdmin && !user.isSystemAdmin) {
        return NextResponse.json({ error: 'Elevated permission required' }, { status: 403 });
      }
      return NextResponse.json(
        await clearPlatformEmergencyPause({
          environment: body.environment || 'PRODUCTION',
          actorId: user.id,
          useMemory,
        })
      );
    }

    if (action === 'classify-pending-online') {
      return NextResponse.json(classifyPendingOnlineWork(body.item || {}));
    }

    if (action === 'classify-pending-offline') {
      return NextResponse.json(classifyPendingOfflineWork(body.item || {}));
    }

    // Tenant cannot clear MRA
    if (action === 'clear-restriction') {
      if (body.clearAuthority === 'TENANT' && body.reasonCode === 'MRA_TERMINAL_BLOCKED') {
        throw RestrictionErrors.terminalMraBlocked();
      }
      return NextResponse.json(
        {
          error: {
            code: 'USE_UNBLOCK_WORKFLOW',
            message: 'Use Unblock Request + verified clearance + revalidation. Direct clear is not exposed to browser for MRA blocks.',
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return errResponse(error);
  }
}
