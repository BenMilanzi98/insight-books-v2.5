/**
 * Conversion readiness — Phase 12 Wave 3.
 * Checklist + typed handoff payload. NEVER executes Tenant conversion / provision.
 * Closed Won ≠ Tenant / Subscription / Invoice create.
 */

import { CRM_READINESS_STATUS, CRM_TIMELINE_EVENT_TYPE } from '../catalogue.js';
import { resolveCrmAccess, resolveCrmScope } from '../authz.js';
import { CRM_PIPELINE_STAGE, CRM_OPPORTUNITY_STATUS } from '../pipeline/catalogue.js';
import { assertNoProvision } from './close.js';
import { hasCrmOpportunityModel, serializeOpportunity } from './model.js';
import { appendOpportunityTimelineEvent } from './timeline.js';

const CONVERSION_HANDOFF_TYPE = 'CRM_CONVERSION_HANDOFF';
const CONVERSION_HANDOFF_VERSION = 'crm-conversion-readiness-v1-2026-07-30';

function item(key, ok, severity, detail, blocker = false) {
  return {
    key,
    ok: Boolean(ok),
    severity: severity || (ok ? 'INFO' : 'WARN'),
    detail: detail || null,
    blocker: Boolean(blocker),
  };
}

function deriveStatus(items) {
  const blockers = items.filter((i) => i.blocker && !i.ok);
  if (blockers.length > 0) return CRM_READINESS_STATUS.BLOCKED;
  const failed = items.filter((i) => !i.ok);
  if (failed.length === 0) return CRM_READINESS_STATUS.READY;
  const requiredFailed = failed.filter((i) => i.severity !== 'INFO');
  if (requiredFailed.length === 0) return CRM_READINESS_STATUS.PARTIALLY_READY;
  const allSoft = requiredFailed.every((i) => i.severity === 'WARN');
  if (allSoft && requiredFailed.length < items.length) {
    return CRM_READINESS_STATUS.PARTIALLY_READY;
  }
  return CRM_READINESS_STATUS.NOT_READY;
}

function hasEvidence(evidence) {
  if (evidence == null) return false;
  if (Array.isArray(evidence)) return evidence.length > 0;
  if (typeof evidence === 'string') return evidence.trim().length > 0;
  if (typeof evidence === 'object') return Object.keys(evidence).length > 0;
  return false;
}

async function loadOpportunity(prisma, opportunityId) {
  const id = opportunityId ? String(opportunityId).trim() : '';
  if (!id || !hasCrmOpportunityModel(prisma)) return null;
  try {
    if (/^OPP-\d{4}-\d{6}$/.test(id)) {
      return await prisma.crmOpportunity.findUnique({ where: { opportunityNumber: id } });
    }
    return await prisma.crmOpportunity.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

/**
 * Evaluate conversion readiness. Never provisions Tenant/Subscription/Invoice.
 */
export async function evaluateConversionReadiness(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_opportunity_view_forbidden' };
  }

  const row = await loadOpportunity(prisma, args.opportunityId);
  if (!row) return { ok: false, notFound: true, error: 'opportunity_not_found' };

  const scope = await resolveCrmScope(prisma, args.admin, 'opportunities');
  if (!scope.canView) {
    return { ok: false, forbidden: true, reason: 'crm_scope_denied' };
  }

  const items = [];
  const stage = String(row.stageCode || '').toUpperCase();
  const status = String(row.status || '').toUpperCase();
  const isWon =
    stage === CRM_PIPELINE_STAGE.CLOSED_WON || status === CRM_OPPORTUNITY_STATUS.WON;

  items.push(
    item(
      'closed_won',
      isWon,
      isWon ? 'INFO' : 'CRITICAL',
      isWon ? 'Opportunity is CLOSED_WON' : `Must be CLOSED_WON (current: ${stage}/${status})`,
      !isWon
    )
  );

  const evidenceOk = hasEvidence(row.closeEvidence);
  items.push(
    item(
      'close_evidence',
      evidenceOk,
      evidenceOk ? 'INFO' : 'CRITICAL',
      evidenceOk ? 'Close evidence present' : 'Closed Won evidence missing',
      !evidenceOk
    )
  );

  const winReasonOk = Boolean(row.winReason);
  items.push(
    item(
      'win_reason',
      winReasonOk,
      winReasonOk ? 'INFO' : 'CRITICAL',
      winReasonOk ? `Win reason: ${row.winReason}` : 'Win reason required',
      !winReasonOk
    )
  );

  const commercialOk = row.amount != null && Boolean(row.currency);
  items.push(
    item(
      'commercial_estimate',
      commercialOk,
      commercialOk ? 'INFO' : 'WARN',
      commercialOk
        ? `Commercial ${row.amount} ${row.currency}`
        : 'Commercial estimate incomplete (soft)',
      false
    )
  );

  const accountOk = Boolean(row.accountId);
  items.push(
    item(
      'account_linked',
      accountOk,
      accountOk ? 'INFO' : 'WARN',
      accountOk ? 'Account linked' : 'No accountId on Opportunity',
      false
    )
  );

  // Phase 15 Wave 4 — surface commercial acceptance / Phase 16 handoff (soft; never auto stage)
  let commercialAcceptanceOk = false;
  let phase16HandoffOk = false;
  try {
    if (typeof prisma.crmCommercialDocument?.findMany === 'function') {
      const docs = await prisma.crmCommercialDocument.findMany({
        where: { opportunityId: row.id },
      });
      const versionIds = [];
      if (typeof prisma.crmCommercialDocumentVersion?.findMany === 'function') {
        for (const d of docs || []) {
          const versions = await prisma.crmCommercialDocumentVersion.findMany({
            where: { documentId: d.id },
          });
          for (const v of versions || []) versionIds.push(v.id);
        }
      }
      if (
        versionIds.length > 0 &&
        typeof prisma.crmCommercialAcceptance?.findFirst === 'function'
      ) {
        const acc = await prisma.crmCommercialAcceptance.findFirst({
          where: { documentVersionId: { in: versionIds } },
        });
        commercialAcceptanceOk = Boolean(
          acc?.documentVersionId && acc?.checksumSha256 && acc?.authorityRole
        );
        if (
          commercialAcceptanceOk &&
          typeof prisma.crmClosedWonConversionHandoff?.findFirst === 'function'
        ) {
          const handoff = await prisma.crmClosedWonConversionHandoff.findFirst({
            where: { acceptanceId: acc.id },
          });
          phase16HandoffOk = Boolean(handoff);
        }
      }
    }
  } catch {
    commercialAcceptanceOk = false;
    phase16HandoffOk = false;
  }

  items.push(
    item(
      'commercial_acceptance',
      commercialAcceptanceOk,
      commercialAcceptanceOk ? 'INFO' : 'WARN',
      commercialAcceptanceOk
        ? 'Commercial acceptance evidence present (≠ Closed Won)'
        : 'No commercial acceptance bound yet (soft)',
      false
    )
  );
  items.push(
    item(
      'phase16_handoff',
      phase16HandoffOk,
      phase16HandoffOk ? 'INFO' : 'WARN',
      phase16HandoffOk
        ? 'Phase 16 conversion handoff emitted (payload only)'
        : 'Phase 16 handoff not yet emitted (soft)',
      false
    )
  );

  const readinessStatus = deriveStatus(items);
  const idempotencyKey = `conversion-ready:${row.id}:${row.version ?? 1}:${stage}`;

  const handoffPayload = {
    type: CONVERSION_HANDOFF_TYPE,
    version: CONVERSION_HANDOFF_VERSION,
    readinessStatus,
    opportunityId: row.id,
    opportunityNumber: row.opportunityNumber,
    leadId: row.leadId || null,
    accountId: row.accountId || null,
    contactId: row.contactId || null,
    stageCode: stage,
    status,
    winReason: row.winReason || null,
    decisionDate: row.decisionDate
      ? new Date(row.decisionDate).toISOString()
      : null,
    idempotencyKey,
    /** Honesty — never execute conversion in Phase 12 */
    tenantId: null,
    tenantCreated: false,
    subscriptionId: null,
    subscriptionCreated: false,
    invoiceId: null,
    invoiceCreated: false,
    paymentId: null,
    paymentCreated: false,
    conversionExecuted: false,
    inventConversionForbidden: true,
    commercialAcceptancePresent: commercialAcceptanceOk,
    phase16HandoffPresent: phase16HandoffOk,
    acceptanceDoesNotCloseWon: true,
    autoStageMutationForbidden: true,
  };

  const now = args.now || new Date();
  await appendOpportunityTimelineEvent(prisma, {
    opportunityId: row.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.CONVERSION_READINESS,
    summary: `Conversion readiness: ${readinessStatus}`,
    payload: {
      readinessStatus,
      checklistKeys: items.map((i) => i.key),
      conversionExecuted: false,
      tenantCreated: false,
      commercialAcceptancePresent: commercialAcceptanceOk,
      phase16HandoffPresent: phase16HandoffOk,
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  const result = {
    ok: true,
    readinessStatus,
    checklist: items,
    handoffPayload,
    conversionExecuted: false,
    tenantCreated: false,
    subscriptionCreated: false,
    invoiceCreated: false,
    paymentCreated: false,
    opportunity: serializeOpportunity(row),
    meta: {
      definitionVersion: CONVERSION_HANDOFF_VERSION,
      inventConversionForbidden: true,
      closedWonDoesNotProvision: true,
      acceptanceDoesNotCloseWon: true,
      autoStageMutationForbidden: true,
    },
  };

  return { ...result, provisionCheck: assertNoProvision(result) };
}

export function assertNoConversionExecute(result) {
  return (
    result?.conversionExecuted === false &&
    result?.handoffPayload?.tenantId == null &&
    result?.handoffPayload?.conversionExecuted === false &&
    result?.tenantCreated === false &&
    result?.subscriptionCreated === false &&
    result?.invoiceCreated === false
  );
}

export { CONVERSION_HANDOFF_TYPE, CONVERSION_HANDOFF_VERSION };
