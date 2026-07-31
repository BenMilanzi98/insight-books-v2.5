import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import {
  getOfflineContractDecision,
  evaluateEffectiveOfflineCapability,
  evaluateConnectivityTransition,
  evaluateClockTrust,
  evaluateOfflineSaleReadiness,
  createAndSealOfflineEnvelope,
  processOrderedOfflineUploadPartition,
  registerTrustedAgent,
  activateTrustedAgent,
  recordAgentHeartbeat,
  suspendTrustedAgent,
  revokeTrustedAgent,
  denyBrowserForceOfflineEntry,
  assertNotBrowserOnlineAuthoritative,
} from '@/lib/mraEis';
import { MraEisControlError } from '@/lib/mraEis/domain/errors.js';
import { CONNECTIVITY_STATE } from '@/lib/mraEis/domain/operationalEnums.js';

export async function GET(request) {
  const user = await getUserFromSession(request);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const agents = await prisma.mraEisTrustedAgent
    .findMany({
      where: { tenantId: user.tenantId, businessId: user.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 25,
    })
    .catch(() => []);

  return NextResponse.json({
    contracts: getOfflineContractDecision(),
    agents: agents.map((a) => ({
      id: a.id,
      terminalId: a.terminalId,
      environment: a.environment,
      lifecycleState: a.lifecycleState,
      trustState: a.trustState,
      agentVersion: a.agentVersion,
      architecture: a.architecture,
      lastHeartbeatAt: a.lastHeartbeatAt,
      stableDeviceIdentity: a.stableDeviceIdentity,
    })),
    note: 'Certified offline is disabled by default. Production requires CERTIFIED_PRODUCTION. Browser-only fiscal signing is prohibited.',
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

    // Reject client force / key / number / acceptance overrides
    if (
      body.forceOffline ||
      body.forceAccepted ||
      body.privateKey ||
      body.jwt ||
      body.signingKey ||
      body.fiscalNumber ||
      body.clearQueue ||
      body.overrideLimits ||
      body.overrideTerminalBlock
    ) {
      return NextResponse.json(
        {
          error:
            'Client cannot force offline entry/acceptance, supply keys/JWT, choose fiscal numbers, clear queues, or override limits/Terminal blocks.',
          code: 'CLIENT_OFFLINE_FIELDS_REJECTED',
          browserDenial: denyBrowserForceOfflineEntry(),
        },
        { status: 400 }
      );
    }

    if (action === 'evaluate-capability') {
      const result = evaluateEffectiveOfflineCapability({
        tenantId,
        businessId,
        terminalId: body.terminalId || null,
        agentId: body.agentId || null,
        environment: body.environment || 'SANDBOX',
        mode: body.mode || (process.env.MRA_EIS_USE_MOCK === '1' ? 'MOCK' : 'SANDBOX'),
        platformOfflineAvailable: Boolean(body.platformOfflineAvailable),
        tenantOfflineEntitled: Boolean(body.tenantOfflineEntitled),
        businessOfflineEnabled: Boolean(body.businessOfflineEnabled),
        certification: body.certification || null,
        browserContext: true,
        architecture: 'BROWSER_ONLY_PROHIBITED',
      });
      return NextResponse.json(result);
    }

    if (action === 'evaluate-connectivity') {
      // Phase 17: client cannot assert terminalBlocked — server projection is authoritative
      if (body.overrideTerminalBlock || body.forceTerminalUnblocked) {
        return NextResponse.json(
          {
            error:
              'Client cannot override Terminal block state. Phase 17 compliance projection is authoritative.',
            code: 'CLIENT_TERMINAL_BLOCK_OVERRIDE_REJECTED',
          },
          { status: 400 }
        );
      }
      const result = evaluateConnectivityTransition({
        currentState: body.currentState || CONNECTIVITY_STATE.ONLINE_STABLE,
        recentChecks: body.recentChecks || [],
        // Ignore client-supplied terminalBlocked; treat as unknown/false unless server flag provided via trusted path
        terminalBlocked: false,
        capabilityAllowsOfflineEntry: Boolean(body.capabilityAllowsOfflineEntry),
        navigatorOnline: body.navigatorOnline,
      });
      return NextResponse.json({
        ...result,
        terminalBlockSource: 'SERVER_AUTHORITATIVE',
        clientTerminalBlockedIgnored: body.terminalBlocked !== undefined,
        navigatorOnlinePolicy: assertNotBrowserOnlineAuthoritative(body.navigatorOnline),
      });
    }

    if (action === 'evaluate-clock') {
      return NextResponse.json(evaluateClockTrust(body.clockInput || {}));
    }

    if (action === 'evaluate-sale-readiness') {
      return NextResponse.json(
        evaluateOfflineSaleReadiness({
          capabilityInput: {
            tenantId,
            businessId,
            terminalId: body.terminalId,
            agentId: body.agentId,
            environment: body.environment || 'SANDBOX',
            mode: body.mode || 'MOCK',
            browserContext: true,
          },
          connectivityState: body.connectivityState || CONNECTIVITY_STATE.ONLINE_STABLE,
          limitInput: body.limitInput || {},
          clockInput: body.clockInput || {},
          proposedSale: body.proposedSale || {},
          vat5Requested: Boolean(body.vat5Requested),
          creditSale: Boolean(body.creditSale),
          splitPayment: Boolean(body.splitPayment),
        })
      );
    }

    if (action === 'register-agent') {
      const result = await registerTrustedAgent({
        tenantId,
        businessId,
        branchId: body.branchId || null,
        siteMappingId: body.siteMappingId || null,
        terminalId: body.terminalId,
        environment: body.environment || 'SANDBOX',
        agentType: body.agentType || 'DEVICE_AGENT',
        agentVersion: body.agentVersion || '0.0.0-mock',
        actorUserId: user.id,
      });
      return NextResponse.json(result);
    }

    if (action === 'activate-agent') {
      const result = await activateTrustedAgent({
        tenantId,
        businessId,
        agentId: body.agentId,
        bootstrapToken: body.bootstrapToken,
        actorUserId: user.id,
      });
      return NextResponse.json(result);
    }

    if (action === 'heartbeat') {
      const result = await recordAgentHeartbeat({
        tenantId,
        businessId,
        agentId: body.agentId,
        safeMetadata: body.safeMetadata || {},
      });
      return NextResponse.json(result);
    }

    if (action === 'suspend-agent') {
      const result = await suspendTrustedAgent({
        tenantId,
        businessId,
        agentId: body.agentId,
        reason: body.reason,
        actorUserId: user.id,
      });
      return NextResponse.json(result);
    }

    if (action === 'revoke-agent') {
      const result = await revokeTrustedAgent({
        tenantId,
        businessId,
        agentId: body.agentId,
        reason: body.reason,
        lost: Boolean(body.lost),
        compromised: Boolean(body.compromised),
        actorUserId: user.id,
      });
      return NextResponse.json(result);
    }

    if (action === 'seal-envelope-mock') {
      // Mock/dev only — never production path from browser
      if (process.env.MRA_EIS_USE_MOCK !== '1' && body.mode !== 'MOCK') {
        return NextResponse.json(
          { error: 'Browser cannot seal authoritative offline envelopes outside MOCK mode.' },
          { status: 403 }
        );
      }
      const result = await createAndSealOfflineEnvelope({
        tenantId,
        businessId,
        terminalId: body.terminalId || 'mock-terminal',
        agentId: body.agentId || 'mock-agent',
        deviceIdentity: body.deviceIdentity || 'mock-device',
        environment: body.environment || 'SANDBOX',
        mode: 'MOCK',
        fiscalSnapshotId: body.fiscalSnapshotId || `snap-${Date.now()}`,
        snapshotChecksum: body.snapshotChecksum || 'mock-checksum',
        snapshotPayload: body.snapshotPayload || {
          sellerTin: 'TIN123',
          currency: 'MWK',
          grossTotal: '100.00',
          taxTotal: '0.00',
          levyTotal: '0.00',
          transactionTimestamp: new Date().toISOString(),
          lines: [],
        },
        browserContext: false, // server-side mock sealing only
      });
      return NextResponse.json({
        envelope: {
          id: result.envelope.id,
          offlineFiscalNumber: result.envelope.offlineFiscalNumber,
          state: result.envelope.state,
          receiptStatus: result.envelope.receiptStatus,
          receiptWording: result.envelope.receiptWording,
          claimsMraAcceptance: result.envelope.claimsMraAcceptance,
          signatureVerified: result.envelope.signatureVerified,
          canonicalPayloadChecksum: result.envelope.canonicalPayloadChecksum,
        },
        queueItem: {
          id: result.queueItem.id,
          queueSequence: result.queueItem.queueSequence,
          state: result.queueItem.state,
          sealedChecksum: result.queueItem.sealedChecksum,
        },
        journalCreated: false,
        stockMovementCreated: false,
        mraUploadPerformed: false,
      });
    }

    if (action === 'upload-partition-mock') {
      if (process.env.MRA_EIS_USE_MOCK !== '1' && body.mode !== 'MOCK') {
        return NextResponse.json({ error: 'Mock upload only.' }, { status: 403 });
      }
      const result = await processOrderedOfflineUploadPartition({
        items: body.items || [],
        environment: body.environment || 'SANDBOX',
        mode: 'MOCK',
        terminalBlocked: Boolean(body.terminalBlocked),
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    if (err instanceof MraEisControlError) {
      return NextResponse.json(
        {
          error: {
            code: err.code,
            message: err.message,
            requiredAction: err.requiredAction,
            retryable: err.retryable,
            details: err.details || null,
          },
        },
        { status: err.httpStatus || 400 }
      );
    }
    console.error('offline API error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
