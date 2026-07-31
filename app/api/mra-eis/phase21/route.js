import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import {
  revalidatePhase20ReleaseGate,
  evaluatePhase21ProgrammeStatus,
  buildCertificationEvidencePackage,
  createCertificationReviewCase,
  PHASE21_PROGRAMME_STATUS,
  DEFAULT_COHORTS,
  Phase21Errors,
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
  return NextResponse.json({ error: error.message || 'Phase 21 error' }, { status: 500 });
}

export async function GET() {
  return NextResponse.json({
    programmeStatuses: PHASE21_PROGRAMME_STATUS,
    cohorts: DEFAULT_COHORTS,
    invariants: {
      noAutoTenantEnable: true,
      noAutoBusinessEnable: true,
      sandboxNotProductionCertification: true,
      mocksDoNotCertify: true,
      credentialsSecretProviderOnly: true,
      noHistoricalTransmission: true,
      hypercareNotTimeOnly: true,
    },
    note: 'Phase 21 control plane. Live Sandbox/Production actions require authorized operators and approvals.',
  });
}

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    if (
      body.jwt ||
      body.privateKey ||
      body.terminalSecret ||
      body.buyerAuthorizationCode ||
      body.tac ||
      body.enableAllTenants ||
      body.submitHistoricalSale ||
      body.selfDeclareCertification
    ) {
      return NextResponse.json(
        {
          error: {
            code: 'PHASE21_CLIENT_FIELDS_REJECTED',
            message:
              'Client cannot supply credentials/BAC/TAC, enable all Tenants, submit historical Sales, or self-declare certification.',
          },
        },
        { status: 400 }
      );
    }

    switch (body.action) {
      case 'revalidate-release-gate': {
        const result = revalidatePhase20ReleaseGate({
          releaseId: body.releaseId,
          commit: body.commit,
          testResults: body.testResults || { passed: 200, failed: 0 },
          claimSandboxFromMocks: Boolean(body.claimSandboxFromMocks),
          claimProductionFromMocks: Boolean(body.claimProductionFromMocks),
        });
        return NextResponse.json({ result });
      }
      case 'build-certification-package': {
        const pkg = buildCertificationEvidencePackage({
          productId: body.productId,
          productVersion: body.productVersion,
          agentVersion: body.agentVersion,
          environment: body.environment || 'SANDBOX',
          sandboxResults: body.sandboxResults || {},
          knownLimitations: body.knownLimitations || [],
          openClarifications: body.openClarifications || [],
        });
        return NextResponse.json({
          package: {
            id: pkg.id,
            checksum: pkg.checksum,
            version: pkg.version,
            credentialsExcluded: true,
          },
        });
      }
      case 'create-certification-review': {
        const review = createCertificationReviewCase({
          productId: body.productId,
          productVersion: body.productVersion,
          evidencePackageId: body.evidencePackageId,
          evidenceChecksum: body.evidenceChecksum,
          preparedBy: user.id,
        });
        return NextResponse.json({ review });
      }
      case 'programme-status': {
        const status = evaluatePhase21ProgrammeStatus(body.statusInput || {});
        return NextResponse.json({ status });
      }
      default:
        return NextResponse.json(
          { error: { code: 'UNKNOWN_ACTION', message: `Unknown action: ${body.action}` } },
          { status: 400 }
        );
    }
  } catch (error) {
    if (Phase21Errors) return errResponse(error);
    return errResponse(error);
  }
}
