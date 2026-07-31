import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma.js';
import {
  guardSecurityRoute,
  securityErrorResponse,
} from '../../../../lib/securityGovernance/api/routeGuard.js';
import { SECURITY_PERMISSIONS } from '../../../../lib/securityGovernance/permissions.js';
import {
  createApprovalPolicy,
  publishApprovalPolicyVersion,
  submitApprovalRequest,
  decideApprovalRequest,
} from '../../../../lib/securityGovernance/application/approvalService.js';

export async function GET(request) {
  try {
    const guard = await guardSecurityRoute(request, SECURITY_PERMISSIONS.VIEW_APPROVALS);
    if (guard.response) return guard.response;
    const [policies, requests] = await Promise.all([
      prisma.secV2ApprovalPolicy.findMany({
        where: { businessId: guard.context.businessId },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      prisma.secV2ApprovalRequest.findMany({
        where: { businessId: guard.context.businessId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { decisions: true },
      }),
    ]);
    return NextResponse.json({ policies, requests });
  } catch (error) {
    return securityErrorResponse(error, 'list approvals');
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (body.action === 'createPolicy') {
      const guard = await guardSecurityRoute(
        request,
        SECURITY_PERMISSIONS.MANAGE_APPROVAL_POLICIES
      );
      if (guard.response) return guard.response;
      const policy = await createApprovalPolicy(prisma, guard.context, body);
      return NextResponse.json({ policy });
    }
    if (body.action === 'publishVersion') {
      const guard = await guardSecurityRoute(
        request,
        SECURITY_PERMISSIONS.MANAGE_APPROVAL_POLICIES
      );
      if (guard.response) return guard.response;
      const version = await publishApprovalPolicyVersion(
        prisma,
        guard.context,
        body.policyId,
        body
      );
      return NextResponse.json({ version });
    }
    if (body.action === 'submit') {
      const guard = await guardSecurityRoute(request, SECURITY_PERMISSIONS.VIEW_APPROVALS);
      if (guard.response) return guard.response;
      const approvalRequest = await submitApprovalRequest(prisma, guard.context, body);
      return NextResponse.json({ request: approvalRequest });
    }
    if (body.action === 'decide') {
      const guard = await guardSecurityRoute(request, SECURITY_PERMISSIONS.DECIDE_APPROVAL);
      if (guard.response) return guard.response;
      const updated = await decideApprovalRequest(prisma, guard.context, body.requestId, {
        decision: body.decision,
        reason: body.reason,
        currentPayload: body.currentPayload,
      });
      return NextResponse.json({ request: updated });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return securityErrorResponse(error, 'approval action');
  }
}
